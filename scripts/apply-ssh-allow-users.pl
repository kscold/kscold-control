#!/usr/bin/perl -T
use strict;
use warnings;
use Digest::SHA qw(sha256_hex);
use Fcntl qw(:DEFAULT :flock :mode);
use File::Temp qw(tempfile);
use Socket qw(AF_INET AF_INET6 inet_pton);

my $limit = 65_536;

sub read_bounded {
    my ($handle, $max) = @_;
    my $data = '';
    while (length($data) <= $max) {
        my $count = read($handle, my $chunk, $max + 1 - length($data));
        die "read failed\n" unless defined $count;
        last if $count == 0;
        $data .= $chunk;
    }
    die "input too large\n" if length($data) > $max;
    return $data;
}

sub read_owned_file {
    my ($path, $owner, $max) = @_;
    sysopen(my $file, $path, O_RDONLY | O_NOFOLLOW | O_NONBLOCK)
        or die "cannot open configuration\n";
    my @info = stat($file);
    die "unsafe configuration file\n"
        unless @info && S_ISREG($info[2]) && $info[4] == $owner && !($info[2] & 0022);
    return read_bounded($file, $max);
}

sub valid_rule {
    my ($rule) = @_;
    return 0 unless $rule =~ /\A[A-Za-z0-9_][A-Za-z0-9_.-]*\@([A-Fa-f0-9:.]+)(?:\/(0|[1-9][0-9]{0,2}))?\z/;
    my ($address, $prefix) = ($1, $2);
    my $v6 = index($address, ':') >= 0;
    return 0 if defined($prefix) && $prefix > ($v6 ? 128 : 32);
    return defined inet_pton($v6 ? AF_INET6 : AF_INET, $address);
}

sub require_protected_rule {
    my ($config, $protected) = @_;
    my $found = 0;
    for my $line (split /\r?\n/, $config) {
        $line =~ s/(?:\A|[ \t]+)\#.*\z//;
        $line =~ s/\A[ \t]+|[ \t]+\z//g;
        next unless length($line);
        my ($directive, @rules) = split /[ \t]+/, $line;
        die "unsupported configuration\n"
            unless lc($directive) eq 'allowusers' && @rules;
        for my $rule (@rules) {
            die "invalid allow rule\n" unless valid_rule($rule);
            $found = 1 if $rule eq $protected;
        }
    }
    die "protected allow rule missing\n" unless $found;
}

sub apply_change {
    my ($target, $temp_dir, $owner, $protected, $input, $validate) = @_;
    my ($requested_target, $revision, $next) = split /\n/, $input, 3;
    die "invalid revision\n" unless defined($next) && $revision =~ /\A[a-f0-9]{64}\z/;
    return 75 if $requested_target ne $target;
    die "invalid candidate size\n" if length($next) > $limit;
    die "invalid protected rule\n" unless valid_rule($protected);
    my $current = read_owned_file($target, $owner, $limit);
    return 75 if sha256_hex($current) ne $revision;
    require_protected_rule($current, $protected);
    require_protected_rule($next, $protected);
    return 0 if $current eq $next;

    my ($candidate, $name) = tempfile('.control-allow-users-XXXXXXXX', DIR => $temp_dir, UNLINK => 1);
    print {$candidate} $next or die "cannot write candidate\n";
    close($candidate) or die "cannot close candidate\n";
    chmod(0644, $name) == 1 or die "cannot set candidate permissions\n";
    $validate->($name);
    return 75 if read_owned_file($target, $owner, $limit) ne $current;
    rename($name, $target) or die "cannot install candidate\n";
    return 0;
}

sub main {
    die "requires root and no arguments\n" unless $> == 0 && !@ARGV;
    local %ENV = (PATH => '/usr/bin:/bin:/usr/sbin:/sbin', LC_ALL => 'C');
    my $settings = read_owned_file('/etc/ssh/kscold-control-allow-users', 0, 1024);
    my ($filename, $protected) = split /\n/, $settings;
    die "invalid managed filename\n"
        unless defined($filename) && $filename =~ /\A([A-Za-z0-9][A-Za-z0-9_.-]*\.conf)\z/;
    $filename = $1;
    sysopen(my $lock, '/var/run/kscold-control-allow-users.lock', O_CREAT | O_NOFOLLOW | O_RDWR, 0600)
        or die "cannot open lock\n";
    return 75 unless flock($lock, LOCK_EX | LOCK_NB);
    my $target = "/etc/ssh/sshd_config.d/$filename";
    my $input = read_bounded(\*STDIN, $limit + length($target) + 66);
    return apply_change($target, '/etc/ssh', 0, $protected // '', $input,
        sub {
            my ($candidate) = @_;
            # 임시 파일은 Include 대상 폴더 밖에 두어 검증 전에 sshd가 읽지 않게 한다.
            die "current SSH configuration failed validation\n"
                unless system('/usr/sbin/sshd', '-t') == 0;
            die "candidate SSH configuration failed validation\n"
                unless system('/usr/sbin/sshd', '-t', '-f', $candidate) == 0;
        });
}

exit(main()) unless caller;
1;
