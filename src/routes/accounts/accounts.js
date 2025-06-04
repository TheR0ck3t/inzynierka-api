const express = require('express');
const router = express.Router();
const db = require('../../modules/dbModules/db'); // Import bazy danych
const authToken = require('../../modules/authModules/authToken')



router.get('/', (req, res) => {
    const query = 'SELECT * FROM users';
    db.any(query)
        .then(data => {
            console.log("Data fetched successfully:", data);
            res.json({
                status: 'success',
                message: 'Fetched all users successfully',
                data: data
            });
        })
        .catch(error => {
            console.error("Error fetching data:", error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch users',
                error: error.message || error
            });
        });
});

router.post('/create', authToken, async (req, res) => {
    const { firstName, lastName, email } = req.body;
    console.log("Received data:", { firstName, lastName, email });

    // Używamy tekstu zapytania z bezpośrednimi parametrami
    const query =  'INSERT INTO users (first_name, last_name, email) VALUES ($1, $2, $3) RETURNING *'
    const values =  [firstName, lastName, email]; ;
    try {
        const data = await db.one(query,values);
        console.log("Data inserted successfully:", data);
        res.json({
            status: 'success',
            message: 'Account created successfully!',
            data: data
        });
    } catch (error) {
        console.error("Error inserting data:", error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create account.',
            error: error.message || error
        });
    }
});

router.delete('/delete/:id', (req, res) => {
    const userId = req.params.id;
    
    db.result('DELETE FROM users WHERE id = $1', [userId])
        .then(result => {
            if (result.rowCount > 0) {
                res.json({
                    status: 'success',
                    message: 'User deleted successfully',
                    deletedCount: result.rowCount
                });
            } else {
                res.status(404).json({
                    status: 'error',
                    message: 'User not found'
                });
            }
        })
        .catch(error => {
            console.error("Error deleting user:", error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to delete user',
                error: error.message || error
            });
        });
});

router.put('/update/', authToken, async (req, res) => {
    const userId = req.user.id;
console.log("User ID from token:", req.user.id);
    const updates = req.body;
    
    try {
        // Budujemy dynamiczne zapytanie SQL
        const fields = Object.keys(updates).filter(field => 
            ['first_name', 'last_name', 'email'].includes(field)
        );
        
        if (fields.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No valid fields to update'
            });
        }
        
        // Tworzymy części zapytania SET
        const setStatements = fields.map((field, index) => 
            `${field} = $${index + 1}`
        );
        
        // Budujemy zapytanie SQL
        const query = `
            UPDATE users 
            SET ${setStatements.join(', ')} 
            WHERE id = $${fields.length + 1}
            RETURNING *
        `;
        
        // Przygotowujemy wartości
        const values = [...fields.map(field => updates[field]), userId];
        
        const updatedUser = await db.one(query, values);
        
        res.json({
            status: 'success',
            message: 'User updated successfully',
            data: updatedUser
        });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update user',
            error: error.message || error
        });
    }
});

module.exports = {
   path: '/accounts',
    router,
    routeName: 'accounts' 
}