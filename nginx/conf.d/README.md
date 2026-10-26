# Nginx 설정 / Configuration

공개 저장소에는 [범용 템플릿](./app-stack.conf.example)만 보관합니다.
실제 도메인, 인증서, 업스트림 주소가 들어간 `*.conf`와 백업본은 로컬 전용입니다.
Only generic templates belong in Git. Real domains, certificates and upstreams stay local.

1. `app-stack.conf.example`을 `<service>.conf`로 복사합니다.
2. 운영자가 자신의 도메인, 인증서 경로, 업스트림 주소를 입력합니다.
3. 실제 컨테이너에서 `nginx -t`가 성공한 경우에만 reload합니다.

`pnpm check:nginx`는 별도의 임시 컨테이너에서 공개 템플릿만 검사합니다.
현재 운영 Nginx를 재시작하거나 실제 사이트 설정을 바꾸지 않습니다.
실제 설정 파일과 인증서를 Git에 추가하지 마세요.
