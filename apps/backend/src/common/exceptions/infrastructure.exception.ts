import {
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * Infrastructure Exception Classes
 * Used when external services or infrastructure fail
 */

export class DockerConnectionException extends ServiceUnavailableException {
  constructor(details?: string) {
    super(
      details
        ? `Docker connection failed: ${details}`
        : 'Could not connect to Docker daemon',
    );
  }
}

export class DockerOperationException extends InternalServerErrorException {
  constructor(operation: string, details?: string) {
    super(
      details
        ? `Docker ${operation} failed: ${details}`
        : `Docker ${operation} operation failed`,
    );
  }
}

export class DatabaseOperationException extends InternalServerErrorException {
  constructor(operation: string, details?: string) {
    super(
      details
        ? `Database ${operation} failed: ${details}`
        : `Database ${operation} operation failed`,
    );
  }
}

export class FileSystemException extends InternalServerErrorException {
  constructor(operation: string, path?: string) {
    super(
      path
        ? `File system ${operation} failed for path '${path}'`
        : `File system ${operation} operation failed`,
    );
  }
}

export class PortForwardingException extends InternalServerErrorException {
  constructor(details?: string) {
    super(
      details
        ? `Port forwarding failed: ${details}`
        : 'Port forwarding operation failed',
    );
  }
}

export class PTYProcessException extends InternalServerErrorException {
  constructor(details?: string) {
    super(
      details
        ? `PTY process failed: ${details}`
        : 'PTY process operation failed',
    );
  }
}
