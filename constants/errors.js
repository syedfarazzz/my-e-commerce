exports.UNAUTHORIZED = {
  NOT_LOGGED_IN: `You are not logged in please login to get Access`,
  INVALID_JWT: `Invalid token! Please Login Again`,
  EXPIRED_JWT: `Your token has expired! please login again`,
  NOT_VERIFIED: `Your Account is not verified, Please Verify First`,
  INVALID_EXPIRED: `Token is invalid or has been Expired`,
  PASSWORD_CHANGED: "You have recently changed password! Please login again.",
  UNAUTHORIZE: "You are not authorize to perform this action",
  UNABLE: "You are unable to perform this action",
  DELETED: 'Your account has been deleted!',
  BANNED:
    "You have violated our Privacy Policy & Terms. For Further Information please contact our Customer Support Center.",
  VERIFY_OTP: "Kindly enter OTP sent on your email"
};

exports.PROGRAMMING = {
  SOME_ERROR: `Something went wrong`,
};

exports.RUNTIME = {
  SENDING_TOKEN: `There was error sending Token. Please try again later`,
};

exports.REQUIRED = {
  EMAIL_REQUIRED: `Email is required`,
  USER_ID_REQUIRED: "User id is required",
  CREATED_REQUIRED: `CREATED by Id is required`,
  ROLE_REQUIRED: `ROLE is required eg admin, authenticated, manager, vender, cleaner, venderManager`,
  FIRSTNAME_REQUIRED: `FirstName is required`,
  LASTNAME_REQUIRED: `LastName is required`,
  USERNAME_REQUIRED: "Username is Required",
  PASSWORD_REQUIRED: `Password is required`,
  PHONE_REQUIRED: `Phone Number is required`,
  WHATSAPP_REQUIRED: `Whatsapp Number is required`,
  IMAGE_REQUIRED: `Image is required`,
  TITLE_REQUIRED: "Title is required. Please Enter Title",
  CATEGORY_REQUIRED: "Category is required. Please enter Category",
  COMPANY_REQUIRED: "Company Name is Required",
  TRADE_LICENCE_REQUIRED: "TradeLicence is required",
  DESCRIPTION_REQUIRED: "Description Required",
  BRAND_REQUIRED: "Product brand is required",
  PRODUCT_ID_REQUIRED: "Product ID is required",
  BOOKING_PROVIDER: "Boking must belongs to a provider",
  BOOKING_CUSTOMER: "Booking must belongs to a customer",
  PRICE_REQUIRED: "Price is required",
  START_DATE: "Start Date is Required",
  END_DATE: "End Date is Required",
  STATE_REQUIRED: "State is Required",
  CITY_REQUIRED: "City is Required",
  CODE_REQUIRED: "Country Code is Required",
  REFERENCE_REQUIRED: "Reference is Required",
  JOB_ID_REQUIRED: "jobId which you want to assign is Required",
  ALL_FIELDS_REQUIRED: "All fields are mendatory",
  USER_REQUIRED: "User Id is required",
  QUANTITY_REQUIRED: "Quantity is required"
};

exports.UNIQUE = {
  UNIQUE_TITLE: "Title must be unique",
};

exports.INVALID = {
  INVALID_RESET_LINK: "Password reset code is invalid or has been expired",
  INVALID_LOGIN_CREDENTIALS: "Email or Password is Incorrect",
  INVALID_FORGOT_PASSWORD_CREDENTIALS:
    "Email or Phone Number is Incorrect or does not exist",
  WRONG_CREDENTIAL_ERROR_EMAIL: `Email or password is incorrect`,
  WRONG_CREDENTIAL_ERROR_PHONE: `Phone or password is incorrect`,
  NO_CREDENTIALS_EMAIL: `Please provide email and password`,
  NO_FIREBASE_TOKEN: `Please provide firebase token`,
  NO_CREDENTIALS_PHONE: `Please provide Phone Number and password`,
  INVALID_EMAIL: `Please Enter Valid Email`,
  INVALID_PHONE: `Please Enter Valid Phone(a)`,
  INVALID_FIRSTNAME: `FirstName must only contain characters between A-Z`,
  INVALID_LASTNAME: `lastName must only contain characters between A-Z`,
  INVALID_PHONE_NUM: `Please Enter Valid Phone Number`,
  PASSWORD_LENGTH: `Enter Password with 8 or more characters`,
  PASSWORD_MISMATCH: `Password and ConfirmPassword are not equal`,
  INVALID_PASSWORD: "Invalid Password",
  NOT_FOUND: "Not Found",
  UNABLE_TO_CREATE: "Unable to Create",
  UNABLE_TO_DELETE: "Unable to delete",
  UNABLE_TO_UPDATE: "Unable to Update",
  INVALID_VERIFICATION_TOKEN:
    "Verification Code is invalid or has been expired",
  VERIFY_EMAIL: "Please verify your email address first",
  NOT_ACTIVATED: "Your account Not activated yet",
  INVALID_OTP: "Incorrect OTP",
  INVALID_CODE: "Invalid Code",
  EXPIRED_CODE: "Expired Code",
  NOT_APPROVED: "Your Account is not approved yet",
  INVALID_ID: 'Invalid ID format',
  NO_USER_PHONE: 'No user found with that Phone Number',
  INVALID_BOOKING_STATUS: 'Invalid Booking Status',
  JOB_NOT_FOUND: "No such job found",
  JOB_ERROR: "Error in creating a job, Kindly try assiging again",
  FORBIDDEN: "You are not permitted to perform this action",
  EMAIL_USED: "Email is in already in use",
  USER_NOT_FOUND: "User not found",
  INTERNAL_SERVER: "Internal Server Error",
  FORBIDDEN_APP: "You are not allowed to log-in from any device except mobile app",
  INVALID_FIELD: "No valid fields to update",
  FILTER_JSON: "Please send filter in JSON body",
  FILTER_MISSING: "Error in fetching, filter parameter missing",
  NO_RESERVATION: "No new reservations",
  INVALID_UNIT_INFO: "Reservations found but its unit_id info is incomplete",
  NO_NEW_DATA: "No new data to insert",
  STREAMLINE_ERROR: "Error in createStreamlinevrsQueueJob:",
  DESCRIPTION_LENGTH: "Enter Description with 15 or more characters",
  NOT_FOUND: "Entity Not Found"

};
