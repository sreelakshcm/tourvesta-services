import mongoose, { Schema, model } from 'mongoose';
import slugify from 'slugify';
// import User from './userModel.js';

const tourSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'A Tour must have a Name!'], //validator //works only when runValidators: true
      unique: true,
      trim: true,
      maxlength: [
        40,
        'A tour name must have lesser than or equal to 40 characters',
      ], //validator //works only when runValidators: true
      minlength: [
        10,
        'A tour name must have greater than or equal to 3 characters',
      ], //validator //works only when runValidators: true
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A Tour must have a Duration!'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A Tour must have a group size!'],
    },
    difficulty: {
      type: String,
      required: [true, 'A Tour must have a difficulty!'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium or difficult',
      }, //validator //works only when runValidators: true
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'], //validator //works only when runValidators: true
      max: [5, 'Rating must be below 5.0'], //validator //works only when runValidators: true
      set: (val) => Math.round(val * 10) / 10,
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A Tour must have a price!'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        // Custom Validator
        validator: function (val) {
          // this only points to current doc on NEW document creation
          return val < this.price;
        },
        message: 'Discount price ({VALUE}) should be below regular price', // mongoDb assigns the VALUE that is the same value in val.
      },
    },
    summary: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A Tour must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false,
    },
    startLocation: {
      //GeoJSON - type and coordinates are required for mongoDB to identify a location as geoJSON
      type: {
        type: String,
        default: 'Point', // 'Polygons', 'Lines' etc.,
        enum: ['Point'],
      },
      coordinates: [Number], //[latitude,longitude]
      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User', // reference to another model User, by this we create a relationship between Tour and User model
      },
    ],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// tourSchema.index({ price: 1 }); // single field index; 1: ascending, -1: descending
tourSchema.index({ price: 1, ratingsAverage: -1 }); // compound field index; 1: ascending, -1: descending
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' });

tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7;
});

// Virtual Populate
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour', // in the foreign model(Review) the foreign field is tour
  localField: '_id', // the local field for the foreign model field tour is _id
});

// Document middleware: only runs before .save() and .create()
tourSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// tourSchema.pre('save', async function (next) {
//   const guidesPromises = this.guides.map(async (id) => await User.findById(id));

//   this.guides = await Promise.all(guidesPromises);
//   next();
// });

// tourSchema.post('save', function (doc, next) {
//   console.log('New tour saved... and published!\n', doc);
//   next();
// });

//QUERY MIDDLEWARE
tourSchema.pre(/^find/, function (next) {
  // we populate the guides with the user data from User model
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });
  next();
});

tourSchema.pre(/^find/, function (next) {
  this.find({ secretTour: { $ne: true } });
  this.start = Date.now();
  next();
});

// tourSchema.post(/^find/, function (docs, next) {
//   console.log(`Query took ${Date.now() - this.start}ms.`);
//   // console.log(docs);
//   next();
// });

// AGGREGATION MIDDLEWARE
tourSchema.pre('aggregate', function (next) {
  // Hide secret tours if geoNear is NOT used
  if (!(this.pipeline().length > 0 && '$geoNear' in this.pipeline()[0])) {
    this.pipeline().unshift({
      $match: { secretTour: { $ne: true } },
    });
  }
  next();
});

const Tour = model('Tour', tourSchema);

export default Tour;
