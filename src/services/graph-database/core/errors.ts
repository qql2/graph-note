export class DatabaseError extends Error {
  originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = "DatabaseError";
    this.originalError = originalError;
  }
}

export class NodeNotFoundError extends DatabaseError {
  constructor(nodeId: string) {
    super(`Node with id ${nodeId} not found`);
    this.name = "NodeNotFoundError";
  }
}

export class EdgeNotFoundError extends DatabaseError {
  constructor(edgeId: string) {
    super(`Edge with id ${edgeId} not found`);
    this.name = "EdgeNotFoundError";
  }
}

export class ValidationError extends DatabaseError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConnectionError extends DatabaseError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError);
    this.name = "ConnectionError";
  }
}

export class TransactionError extends DatabaseError {
  constructor(message: string, originalError?: Error) {
    super(message, originalError);
    this.name = "TransactionError";
  }
} 