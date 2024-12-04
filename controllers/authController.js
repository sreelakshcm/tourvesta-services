import User from '../models/userModel.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';
import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import sendEmail from '../utils/email.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const signAccessToken = (userDetails) => {
  const { _id, email, name, role } = userDetails;
  return jwt.sign(
    {
      id: _id,
      email,
      username: name,
      role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN,
    }
  );
};
const signRefreshToken = (email) => {
  return jwt.sign(
    {
      email,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
    }
  );
};

const createSendToken = async (
  user,
  statusCode,
  res,
  generateRefreshToken = false
) => {
  const accessToken = signAccessToken(user);
  const cookieOptions = {
    httpOnly: true, // accessible only by web browser
    sameSite: 'None', // cross site cookie
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true; // https

  if (generateRefreshToken) {
    const refreshToken = signRefreshToken(user.email);
    res.cookie('jwt', refreshToken, cookieOptions);
  }

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token: accessToken,
    data: { user },
  });
};

const signUp = catchAsync(async (req, res, next) => {
  const { email, password, name, passwordConfirm, passwordChangedAt, role } =
    req.body;

  if (role === 'admin') return next(new AppError('You are not allowed to add admin roles!', 401));

  const newUser = await User.create({
    email,
    password,
    name,
    passwordConfirm,
    role,
    passwordChangedAt,
  });

  createSendToken(newUser, 201, res, true); // Pass true to generate refreshToken
});

const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  // 1. Check if email & password exists
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }
  // 2. Check if user exists and password is correct
  const user = await User.findOne({ email }).select('+password +active'); // '+' because it is not selected by default

  // Instance methods are available on documents
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  if (!user.active) return next(new AppError('Unauthorized!', 401));

  user.password = undefined;
  user.active = undefined;

  // 3. If user exists & password is correct, generate JWT and send it to client
  createSendToken(user, 200, res, true); // Pass true to generate refreshToken
});

const protect = catchAsync(async (req, res, next) => {
  // 1. Getting token and check if it exists
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in! Please login', 401));
  }

  // 2. Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3. Check if user still exists
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(new AppError('The User no longer exists', 401));
  }

  // 4. Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfterConfirm(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please login again', 401)
    );
  }

  // Grant access to protected route
  req.user = currentUser; // storing the user for future access like authorization role
  next();
});

const restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles is an array of strings, Ex: ['admin', 'lead-guide']. role = 'user'
    if (!roles.includes(req.user.role)) {
      // We have already assigned the info of user in login method!
      return next(
        new AppError('You do not have permission to perform this action', 403) // 403 - Forbidden
      );
    }
    next();
  };
};

const forgotPassword = catchAsync(async (req, res, next) => {
  // 1. Get user based on posted email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('No user found with that email', 404));
  }

  // 2. Generate random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3. Send reset token to user's email
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH request with your new password and confirm password to: ${resetURL}. \nIF you did'nt forget your password, please ignore this email!`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Your Password Reset token(valid for 10 minutes)',
      message,
    });
  } catch {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        'There was an error sending email. Please try again later',
        500
      )
    );
  }

  res.status(200).json({
    status: 'success',
    message: 'Token sent to your email',
  });
});

const resetPassword = catchAsync(async (req, res, next) => {
  // 1. Get user based on token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+password');

  // 2. If Token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired!', 400));
  }

  if (await bcrypt.compare(req.body.password, user.password)) {
    return next(
      new AppError('New password cannot be same as old password!', 400)
    );
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 3. Update changedPasswordAt property for the user happens in the pre save middleware in model.

  // 4. Save user and send back JWT
  createSendToken(user, 200, res);
});

const updatePassword = catchAsync(async (req, res, next) => {
  // 1. Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2. Check if the posted password is correct
  if (!(await user.correctPassword(req.body.currentPassword, user.password))) {
    return next(new AppError('Current Password is incorrect', 401));
  }

  // 3. If correct, update password
  if (await bcrypt.compare(req.body.newPassword, user.password)) {
    return next(
      new AppError('New password cannot be same as old password!', 400)
    );
  }
  if (req.body.newPassword !== req.body.newPasswordConfirm) {
    return next(new AppError('New Passwords do not match', 400));
  }
  user.password = req.body.newPassword;
  user.passwordConfirm = req.body.newPasswordConfirm;
  await user.save();

  // 4. Log user in and send back JWT
  createSendToken(user, 200, res);
});

const refreshToken = catchAsync(async (req, res, next) => {
  const { cookies } = req;

  if (!cookies?.jwt) {
    return next(new AppError('Unauthorized!', 401));
  }
  const refreshToken = cookies.jwt;

  const decoded = await promisify(jwt.verify)(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  const user = await User.findOne({ email: decoded.email });
  if (!user) {
    return next(new AppError('Unauthorized! Please login!', 401));
  }

  // Generate new tokens
  createSendToken(user, 200, res);
});

const logout = catchAsync(async (req, res, next) => {
  const { cookies } = req;
  const cookieOptions = {
    httpOnly: true, // accessible only by web browser
    sameSite: 'None', // cross site cookie
  };

  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true; // https

  if (!cookies?.jwt) return res.sendStatus(204);
  res.clearCookie('jwt', cookieOptions);
  res.status(200).json({ status: 'success', message: 'Logged out!' });
});

export default {
  signUp,
  login,
  protect,
  restrictTo,
  forgotPassword,
  resetPassword,
  updatePassword,
  refreshToken,
  logout,
};
