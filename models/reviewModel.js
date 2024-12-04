import { model, Schema } from 'mongoose';
import Tour from './tourModel.js';

const reviewSchema = new Schema(
  {
    review: {
      type: String,
      required: [true, 'A review cannot be empty!'],
      maxlength: [500, 'Review must have less than or equal to 500 characters'],
    },
    rating: {
      type: Number,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
    },
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false, // This field won't be returned in the response by default
    },
    tour: {
      type: Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour!'],
    },
    user: {
      type: Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user!'],
    },
  },
  {
    toJSON: { virtuals: true }, // Convert virtual fields to JSON
    toObject: { virtuals: true }, // Convert virtual fields to plain objects
  }
);

reviewSchema.index({ tour: 1, user: 1 }, { unique: true }); // only 1 review for each tour and user

// Query middleware
reviewSchema.pre(/^find/, function (next) {
  //   this.populate({
  //     path: 'tour',
  //     select: 'name',
  //   }).populate({
  //     path: 'user',
  //     select: 'name -_id',
  //   });
  this.populate({
    path: 'user',
    select: 'name -_id',
  });
  next();
});

// whenever a rating is created, updated or deleted calculate the average and num of ratings and update the tour.
reviewSchema.statics.calcAverageRatings = async function (tourId) {
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: '$tour',
        numOfRatings: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsAverage: stats[0].avgRating,
      ratingsQuantity: stats[0].numOfRatings,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsAverage: 0,
      ratingsQuantity: 4.5,
    });
  }
};

// Calculates the average and num of rating while creation of reviews
reviewSchema.post('save', function () {
  // this points to current review
  this.constructor.calcAverageRatings(this.tour);
});

// we use findByIdandUpdate & findByIdAndDelete methods to update/delete the reviews!
// we can only use query middleware for these methods
reviewSchema.post(/^findOneAnd/, async function (doc) {
  await doc.constructor.calcAverageRatings(doc.tour);
});

const Review = model('Review', reviewSchema);

export default Review;
