import express from 'express';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import tourRouter from './routes/tourRoutes.js';
import userRouter from './routes/userRoutes.js';
import reviewRouter from './routes/reviewRoutes.js';
import AppError from './utils/appError.js';
import globalErrorHandler from './controllers/errorController.js';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import { corsOptions } from './config/corsOptions.js';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

dotenv.config({
  path: './config.env',
});

// 1. Global middlewares
// Serving static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Set Security HTTP middleware
app.use(helmet());

// Dev logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Enable CORS
app.use(cors(corsOptions));

// Limit the number of requests for same api
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again in an hour.',
  handler: (req, res, next, options) => {
    // eslint-disable-next-line no-console
    console.log(
      `Too Many requests: ${options.message}\t${req.method}\t${req.url}\t${req.headers.origin}`
    );
    res.status(options.statusCode).send(options.message);
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));

// Cookie parser
app.use(cookieParser());

// Data sanitization against NoSql query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'difficulty',
      'price',
      'ratingsAverage',
      'maxGroupSize',
      'ratingsQuantity',
    ],
  })
);

// test middleware
app.use((req, res, next) => {
  // console.log('headers:', req.headers);
  next();
});

// Routes
// View routes
app.get('/', (req, res) => {
  res.status(200).render('base', {
    tour: 'Wayanad',
    user: 'Sree',
  });
});

// API ROUTES
app.use('/api/v1/users', userRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/reviews', reviewRouter);

app.all('*', (req, res, next) => {
  next(
    new AppError(
      `No routes matched with ${req.originalUrl} on the server!`,
      404
    )
  );
});

//ERROR HANDLING  MIDDLEWARE
app.use(globalErrorHandler);

export default app;
