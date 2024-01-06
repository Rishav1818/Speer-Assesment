const Note = require('../models/Note');
const User = require('../models/User');

const getAllNotes = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch all notes for the authenticated user (user-created or shared)
    const notes = await Note.find({
      $or: [
        { createdBy: userId },
        { sharedWith: userId },
      ],
    });

    res.status(200).json(notes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


const getNoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Fetch a note by ID for the authenticated user
    const note = await Note.findOne({ _id: id, createdBy: userId });

    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    res.status(200).json(note);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


const createNote = async (req, res) => {
  try {
    const { title, content } = req.body;
    const userId = req.user.userId;

    // Create a new note for the authenticated user
    const newNote = new Note({ title, content, createdBy: userId });
    await newNote.save();

    // Update the user's notes array
    await User.findByIdAndUpdate(userId, { $push: { notes: newNote._id } });

    res.status(201).json({ message: 'Note created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { title, content } = req.body;

    // Update an existing note by ID for the authenticated user
    const updatedNote = await Note.findOneAndUpdate(
      { _id: id, createdBy: userId },
      { title, content },
      { new: true }
    );

    if (!updatedNote) {
      return res.status(404).json({ message: 'Note not found' });
    }

    res.status(200).json({ message: 'Note updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Delete a note by ID for the authenticated user
    const deletedNote = await Note.findOneAndDelete({ _id: id, createdBy: userId });

    if (!deletedNote) {
      return res.status(404).json({ message: 'Note not found' });
    }

    res.status(200).json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const shareNote = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { sharedWith } = req.body;

    // Check if the user to share with exists by username or email
    const userToShareWith = await User.findOne({
      $or: [{ username: sharedWith }, { email: sharedWith }],
    });

    if (!userToShareWith) {
      return res.status(404).json({ message: 'User to share with not found' });
    }

    // Share the note with the specified user
    const updatedNote = await Note.findOneAndUpdate(
      { _id: id, createdBy: userId },
      { $addToSet: { sharedWith: userToShareWith._id } },
      { new: true }
    );

    if (!updatedNote) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Also update the shared note in the user's notes array
    await User.findByIdAndUpdate(userToShareWith._id, { $push: { notes: updatedNote._id } });

    res.status(200).json({ message: 'Note shared successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const searchNotes = async (req, res) => {
  try {
    const { q } = req.query;
    const userId = req.user.userId;

    // Create a text index on the 'title' and 'content' fields if not already created
    await Note.ensureIndexes({ title: 'text', content: 'text' });

    // Use text index for searching within the user's notes
    const notes = await Note.find(
      { $text: { $search: q }, createdBy: userId },
      { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } });

    res.status(200).json(notes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = { getAllNotes, getNoteById, createNote, updateNote, deleteNote, shareNote, searchNotes };
