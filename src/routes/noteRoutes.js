const express = require('express');
const noteController = require('../controllers/noteController');
const authenticationMiddleware = require('../middleware/authenticationMiddleware');

const router = express.Router();

// Protect routes with authentication
router.use(authenticationMiddleware);

router.get('/', noteController.getAllNotes);
router.post('/', noteController.createNote);
router.get('/search', noteController.searchNotes);
router.get('/:id', noteController.getNoteById);
router.put('/:id', noteController.updateNote);
router.delete('/:id', noteController.deleteNote);
router.post('/:id/share', noteController.shareNote);


module.exports = router;
