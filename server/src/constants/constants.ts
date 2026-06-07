export const enum HttpStatusCode {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  TOO_MANY_REQUESTS = 429,
  SERVER_ERROR = 500,
}

function createEntityMessages(entity: string) {
  return {
    NOT_FOUND: `${entity} not found`,
    CREATED: `${entity} created successfully`,
    UPDATED: `${entity} updated successfully`,
    DELETED: `${entity} deleted successfully`,
    ALREADY_EXISTS: `${entity} already exists`,
  };
}

export const ApplicationMessage = {
  SERVER_ERROR: 'An error occurred on the server. Please try again later.',
  DATABASE_ERROR: 'There was a database error.',
  ID_FORMAT_ERROR: 'ID must be a positive number',
  NOT_FOUND: 'Not found',
};
export const TourMessage = createEntityMessages('Tour');
// export const UserMessage = createEntityMessages('User');
export const UserMessage = {
  ...createEntityMessages('User'),
  EMAIL_DUPLICATE_ERROR: 'Email already exists',
  EMAIL_NOT_FOUND_ERROR: 'There is no user with email address',
  AUTHENTICATION_ERROR: 'Incorrect email or password',
  UNAUTHORIZED_ACCESS_ERROR:
    'You are not logged in! Please log in to get access.',
  INVALID_TOKEN_ERROR: 'Token is invalid or has expired! Please log in again.',
  INVALID_PASSWORD: 'Incorrect password',
} as const;
