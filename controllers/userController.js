import User from '../models/userModel.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';
import factory from './handlerFactory.js';

const filterPayload = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((field) => {
    if (allowedFields.includes(field)) newObj[field] = obj[field];
  });
  return newObj;
};

const getAllUsers = factory.getAll(User);
const getUser = factory.getOne(User);
const updateUser = factory.updateOne(User);
const deleteUser = factory.deleteOne(User);

const createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'Please use Sign Up!',
  });
};

const getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

const updateMe = catchAsync(async (req, res, next) => {
  // 1. Create error if user posts password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updatePassword',
        400
      )
    );
  }

  // 2. Update current user
  const filteredPayload = filterPayload(req.body, 'name', 'email');
  const updateMe = await User.findByIdAndUpdate(req.user.id, filteredPayload, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    message: 'User Updated Successfully',
    data: {
      user: updateMe,
    },
  });
});

const deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, {
    active: false,
  });

  res.status(204).json({
    status: 'success',
    message: 'User deleted successfully!',
  });
});

export default {
  getAllUsers,
  getUser,
  createUser,
  updateUser,
  deleteMe,
  updateMe,
  deleteUser,
  getMe,
};
