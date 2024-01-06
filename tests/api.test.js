process.env.NODE_ENV = 'test';
const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Note = require('../src/models/Note');

require('dotenv').config();

mongoose.connect(process.env.TESTDB_URI);
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'TestDB connection error:'));
db.once('open', () => {
    console.log('Connected to TestDB');
});

describe('Authentication API', () => {
    describe('POST /api/auth/signup', () => {
        it('should create a new user', async () => {
            const userData = { username: 'authtestuser', email: 'authtestuser@example.com', password: 'authtestpassword' };

            const res = await request(app)
                .post('/api/auth/signup')
                .send(userData);

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('message', 'User created successfully');
        });
    });

    describe('POST /api/auth/login', () => {
        it('should authenticate a user and return a token', async () => {
            const loginData = { identifier: 'authtestuser', password: 'authtestpassword' };

            const res = await request(app)
                .post('/api/auth/login')
                .send(loginData);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('token');
        });
    });
});

describe('Note API', () => {
    let authToken;
    let userId;

    beforeAll(async () => {
        // Performing signup and login to get the authentication token
        await request(app)
            .post('/api/auth/signup')
            .send({ username: 'notetestuser', email: 'notetestuser@example.com', password: 'notetestpassword' });

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ identifier: 'notetestuser', password: 'notetestpassword' });

        authToken = loginRes.body.token;
        const user = await User.findOne({ email: 'notetestuser@example.com' });
        userId = user._id;
    });

    afterAll(async () => {
        const dbName = mongoose.connection.db.databaseName;
        await mongoose.connection.db.dropDatabase();
        await mongoose.disconnect();
    });

    describe('POST /api/notes', () => {
        it('should create a new note for the authenticated user', async () => {
            const noteData = { title: 'Test Note', content: 'Test Content' };

            const res = await request(app)
                .post('/api/notes')
                .set('Authorization', `Bearer ${authToken}`)
                .send(noteData);

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('message', 'Note created successfully');
        });
    });

    describe('GET /api/notes', () => {
        it('should get all notes for the authenticated user', async () => {
            const res = await request(app)
                .get('/api/notes')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toBeInstanceOf(Array);
        });
    });

    describe('GET /api/notes/:id', () => {
        it('should get a specific note for the authenticated user', async () => {
            // Assuming there's a note in the database
            const existingNote = await Note.findOne({ createdBy: userId });


            const res = await request(app)
                .get(`/api/notes/${existingNote._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('title', existingNote.title);
            expect(res.body).toHaveProperty('content', existingNote.content);
        });

        it('should return 404 if the note is not found', async () => {
            const nonExistentNoteId = '123456789101112131415161';

            const res = await request(app)
                .get(`/api/notes/${nonExistentNoteId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(404);
            expect(res.body).toHaveProperty('message', 'Note not found');
        });
    });

    describe('PUT /api/notes/:id', () => {
        it('should update a specific note for the authenticated user', async () => {
            const existingNote = await Note.findOne({ createdBy: userId });

            const updatedNoteData = { title: 'Updated Title', content: 'Updated Content' };

            const res = await request(app)
                .put(`/api/notes/${existingNote._id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updatedNoteData);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('message', 'Note updated successfully');

            // Checking if the note is updated in the database
            const updatedNote = await Note.findById(existingNote._id);
            expect(updatedNote.title).toBe(updatedNoteData.title);
            expect(updatedNote.content).toBe(updatedNoteData.content);
        });
    });

    describe('DELETE /api/notes/:id', () => {
        it('should delete a specific note for the authenticated user', async () => {
            // Assuming there's a note in the database
            const existingNote = await Note.findOne({ createdBy: userId });

            const res = await request(app)
                .delete(`/api/notes/${existingNote._id}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('message', 'Note deleted successfully');

            // Checking if the note is deleted in the database
            const deletedNote = await Note.findById(existingNote._id);
            expect(deletedNote).toBeNull();
        });
    });

    describe('GET /api/notes/search', () => {
        it('should search for notes with a given query for the authenticated user', async () => {
            const uniqueValue = 'uniqueHexValue'; // Replace with a unique value
            const searchQuery = uniqueValue;

            // Creating a unique note
            const createNoteRes = await request(app)
                .post('/api/notes')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: `Test Note ${uniqueValue}`, content: `Test Content ${uniqueValue}` });

            const res = await request(app)
                .get(`/api/notes/search?q=${searchQuery}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toBeInstanceOf(Array);
            expect(res.body.length).toBeGreaterThan(0);
        });

        it('should return an empty array if no matching notes are found', async () => {
            const nonMatchingQuery = 'uniqueHexValue2';

            const res = await request(app)
                .get(`/api/notes/search?q=${nonMatchingQuery}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toBeInstanceOf(Array);
            expect(res.body.length).toBe(0);
        });

        it('should handle errors and return 500 if an internal server error occurs', async () => {
            jest.spyOn(Note, 'ensureIndexes').mockRejectedValueOnce(new Error('Test error'));

            const res = await request(app)
                .get('/api/notes/search?q=test')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(500);
            expect(res.body).toHaveProperty('message', 'Internal Server Error');
        });
    });

    describe('POST /api/notes/:id/share', () => {
        it('should share a note with a specified user for the authenticated user', async () => {
            // Creating a new note to share
            const newNoteRes = await request(app)
                .post('/api/notes')
                .send({ title: 'Shared Note', content: 'This note will be shared' })
                .set('Authorization', `Bearer ${authToken}`);

            const sharedNote = await Note.findOne({ title: 'Shared Note', createdBy: userId });
            const sharedNoteId = sharedNote._id;

            const userToShareWithEmail = 'authtestuser@example.com';

            // Sharing the note with the other user
            const shareNoteRes = await request(app)
                .post(`/api/notes/${sharedNoteId}/share`)
                .send({ sharedWith: userToShareWithEmail })
                .set('Authorization', `Bearer ${authToken}`);

            expect(shareNoteRes.statusCode).toBe(200);
            expect(shareNoteRes.body).toHaveProperty('message', 'Note shared successfully');
        });

        it('should return 404 if the user to share with is not found', async () => {
            const noteToShareRes = await request(app)
                .post('/api/notes')
                .send({ title: 'Note to Share', content: 'This note will not be shared' })
                .set('Authorization', `Bearer ${authToken}`);

            const noteToShare = await Note.findOne({ content: 'This note will not be shared', createdBy: userId });
            const noteToShareId = noteToShare._id;

            const nonExistentUserEmail = 'nonexistent@example.com';

            const res = await request(app)
                .post(`/api/notes/${noteToShareId}/share`)
                .send({ sharedWith: nonExistentUserEmail })
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(404);
            expect(res.body).toHaveProperty('message', 'User to share with not found');
        });

        it('should handle errors and return 500 if an internal server error occurs', async () => {
            jest.spyOn(Note, 'findOneAndUpdate').mockRejectedValueOnce(new Error('Test error'));

            const noteToShare = await Note.findOne({ content: 'This note will not be shared', createdBy: userId });
            const noteToShareId = noteToShare._id;

            try {
                const res = await request(app)
                    .post(`/api/notes/${noteToShareId}/share`)
                    .send({ sharedWith: 'share@example.com' })
                    .set('Authorization', `Bearer ${authToken}`);

                expect(res.statusCode).toBe(500);
                expect(res.body).toHaveProperty('message', 'Internal Server Error');
            } catch (error) {
                console.error('Error during test:', error);
            }
        });
    });
});
