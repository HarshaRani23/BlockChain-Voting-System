const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');
const Web3 = require('web3');
const jwt = require('jsonwebtoken');
const { verifyToken, verifyAdmin } = require('./auth');
const pool = require('./db');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Web3 setup
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));
const votingContractABI = require('../build/contracts/Voting.json').abi;
const votingContract = new web3.eth.Contract(
    votingContractABI,
    process.env.CONTRACT_ADDRESS
);

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { aadharNumber, voterId, fullName } = req.body;

    try {
        const [users] = await pool.query(
            'SELECT * FROM users WHERE aadhar_number = ? AND voter_id = ?',
            [aadharNumber, voterId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        const user = users[0];
        const token = jwt.sign(
            {
                id: user.id,
                isAdmin: user.is_admin,
                aadharNumber: user.aadhar_number,
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        res.json({
            success: true,
            token,
            isAdmin: user.is_admin,
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

// Get candidates
app.get('/api/candidates', async (req, res) => {
    try {
        const [candidates] = await pool.query('SELECT * FROM candidates');
        res.json({ success: true, candidates });
    } catch (error) {
        console.error('Error fetching candidates:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch candidates',
        });
    }
});

// Cast vote
app.post('/api/cast-vote', verifyToken, async (req, res) => {
    const { candidateId } = req.body;
    const aadharNumber = req.user.aadharNumber;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Check if already voted
        const [votes] = await connection.query(
            'SELECT * FROM offline_votes WHERE aadhar_number = ?',
            [aadharNumber]
        );

        if (votes.length > 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Already voted',
            });
        }

        // Record vote
        await connection.query(
            'INSERT INTO offline_votes (aadhar_number, candidate_id) VALUES (?, ?)',
            [aadharNumber, candidateId]
        );

        // If online, sync with blockchain
        if (web3.currentProvider.connected) {
            try {
                await votingContract.methods.vote(candidateId).send({
                    from: process.env.ADMIN_ADDRESS,
                    gas: 200000,
                });
            } catch (error) {
                console.error('Blockchain sync error:', error);
                // Continue with offline vote if blockchain sync fails
            }
        }

        await connection.commit();
        res.json({
            success: true,
            message: 'Vote cast successfully',
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error casting vote:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cast vote',
        });
    } finally {
        connection.release();
    }
});

// Add candidate
app.post(
    '/api/admin/add-candidate',
    verifyToken,
    verifyAdmin,
    async (req, res) => {
        const { name, party, imageHash } = req.body;
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // Add to database
            const [result] = await connection.query(
                'INSERT INTO candidates (name, party, image_hash) VALUES (?, ?, ?)',
                [name, party, imageHash]
            );

            // Add to blockchain
            await votingContract.methods
                .addCandidate(name, party, imageHash)
                .send({
                    from: process.env.ADMIN_ADDRESS,
                    gas: 200000,
                });

            await connection.commit();
            res.json({
                success: true,
                candidateId: result.insertId,
            });
        } catch (error) {
            await connection.rollback();
            console.error('Error adding candidate:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add candidate',
            });
        } finally {
            connection.release();
        }
    }
);

// Sync offline votes
app.post(
    '/api/admin/sync-votes',
    verifyToken,
    verifyAdmin,
    async (req, res) => {
        const connection = await pool.getConnection();

        try {
            const [unsyncedVotes] = await connection.query(
                'SELECT * FROM offline_votes WHERE is_synced = FALSE'
            );

            let syncedCount = 0;
            for (const vote of unsyncedVotes) {
                try {
                    await votingContract.methods
                        .syncOfflineVote(vote.aadhar_number, vote.candidate_id)
                        .send({
                            from: process.env.ADMIN_ADDRESS,
                            gas: 200000,
                        });

                    await connection.query(
                        'UPDATE offline_votes SET is_synced = TRUE WHERE id = ?',
                        [vote.id]
                    );
                    syncedCount++;
                } catch (error) {
                    console.error(`Failed to sync vote ID ${vote.id}:`, error);
                }
            }

            res.json({
                success: true,
                syncedCount,
                totalCount: unsyncedVotes.length,
            });
        } catch (error) {
            console.error('Error syncing votes:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to sync votes',
            });
        } finally {
            connection.release();
        }
    }
);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Open browser based on operating system
    const url = `http://localhost:${PORT}`;
    let command;

    switch (process.platform) {
        case 'win32': // Windows
            command = `start ${url}`;
            break;
        case 'darwin': // macOS
            command = `open ${url}`;
            break;
        default: // Linux
            command = `xdg-open ${url}`;
    }

    exec(command, (err) => {
        if (err) console.error('Failed to open browser:', err);
        else console.log('Browser opened successfully');
    });
});
