import APIFeatures from '../utils/apiFeatures.js';
import AppError from '../utils/appError.js';
import catchAsync from '../utils/catchAsync.js';

const deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const deletedDocument = await Model.findByIdAndDelete(id, {
      new: true,
      runValidators: true,
    });

    if (!deletedDocument) {
      return next(new AppError('No Document found with that ID!', 404));
    }

    res.status(204).json({
      status: 'success',
      message: 'Document Deleted Successfully!',
    });
  });

const updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const doc = await Model.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!doc) {
      return next(new AppError('No Document found with that ID!', 404));
    }
    res.status(200).json({
      status: 'success',
      message: 'Document Updated Successfully',
      data: {
        data: doc,
      },
    });
  });

const createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.create(req.body);
    res.status(201).json({
      status: 'success',
      message: 'Document Created Successfully',
      data: {
        data: doc,
      },
    });
  });

const getOne = (Model, popOptions) =>
  catchAsync(async (req, res, next) => {
    const { id } = req.params;
    let query = Model.findById(id);

    if (popOptions) query.populate(popOptions);

    const doc = await query;

    if (!doc) {
      return next(new AppError('No Document found with that ID!', 404));
    }
    res.status(200).json({
      status: 'success',
      data: doc,
    });
  });

const getAll = (Model) =>
  catchAsync(async (req, res, next) => {
    let filter = {};
    if (req.params.tourId) filter = { tour: req.params.tourId };

    const features = new APIFeatures(Model.find(filter), req.query)
      .filter()
      .sort()
      .limit()
      .pagination();

    const docs = await features.query;
    // const docs = await features.query.explain();

    res.status(200).json({
      status: 'success',
      results: docs.length,
      data: docs,
    });
  });

export default { deleteOne, updateOne, createOne, getOne, getAll };
