import express from 'express';

const router = express.Router();

router.route('/refresh').get();
router.route('/logout').post();
