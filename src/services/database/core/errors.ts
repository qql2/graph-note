export class DatabaseError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = "DatabaseError";

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DatabaseError);
    }

    // If we have an original error, append its stack to ours
    if (originalError?.stack) {
      this.stack = this.stack + "\nCaused by: " + originalError.stack;
    }
  }
}
