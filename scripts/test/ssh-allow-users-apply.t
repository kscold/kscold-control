use strict;
use warnings;
use Digest::SHA qw(sha256_hex);
use File::Temp qw(tempdir);
use FindBin;
use Test::More;

require "$FindBin::Bin/../apply-ssh-allow-users.pl";

my $dir = tempdir(CLEANUP => 1);
my $target = "$dir/allow.conf";
my $protected = 'operator@192.0.2.10';
my $current = "AllowUsers $protected\n";
my $next = $current . "AllowUsers operator\@198.51.100.0/24\n";

sub write_config {
    open(my $file, '>', $target) or die $!;
    print {$file} $current;
    close($file) or die $!;
}

sub apply_config {
    my ($revision, $candidate, $validator) = @_;
    return apply_change($target, $dir, $>, $protected, "$target\n$revision\n$candidate", $validator);
}

write_config();
is(apply_config(sha256_hex('different'), $next, sub { die 'unexpected validation' }), 75,
    'stale request leaves the file untouched');
is(read_owned_file($target, $>, 1024), $current);
is(apply_change($target, $dir, $>, $protected,
    "$dir/other.conf\n" . sha256_hex($current) . "\n$next",
    sub { die 'unexpected validation' }), 75, 'a different target cannot be updated');
is(read_owned_file($target, $>, 1024), $current);

for my $invalid ("AllowUsers operator\@198.51.100.10\n", $next . "Include /tmp/example\n") {
    eval { apply_config(sha256_hex($current), $invalid, sub { die 'unexpected validation' }) };
    like($@, qr/protected allow rule missing|unsupported configuration/);
    is(read_owned_file($target, $>, 1024), $current);
}

eval { apply_config(sha256_hex($current), $next, sub { die "invalid OpenSSH config\n" }) };
like($@, qr/invalid OpenSSH config/);
is(read_owned_file($target, $>, 1024), $current);

is(apply_config(sha256_hex($current), $next, sub {
    is(read_owned_file($_[0], $>, 1024), $next, 'validates candidate');
    is(read_owned_file($target, $>, 1024), $current, 'validates before publishing');
}), 0);
is(read_owned_file($target, $>, 1024), $next);

SKIP: {
    skip 'OpenSSH is not installed', 3
        unless -x '/usr/sbin/sshd' && -x '/usr/bin/ssh-keygen';
    my $host_key = "$dir/host-key";
    is(system('/usr/bin/ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', $host_key), 0,
        'creates an isolated host key');
    write_config();
    is(apply_config(sha256_hex($current), $next, sub {
        die "OpenSSH rejected candidate\n"
            unless system('/usr/sbin/sshd', '-t', '-h', $host_key, '-f', $_[0]) == 0;
    }), 0, 'publishes a candidate accepted by OpenSSH');
    is(read_owned_file($target, $>, 1024), $next);
}
done_testing();
