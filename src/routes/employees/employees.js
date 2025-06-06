const express = require('express');
const router = express.Router();
const db = require('../../modules/dbModules/db'); // Import bazy danych
const authToken = require('../../middleware/authToken')

router.get('/', authToken, async (req, res) => {
    const query = 'SELECT employee_id, first_name, last_name, keycard_id FROM employees';
    db.any(query)
        .then(data => {
            res.json({
                status: 'success',
                message: 'Fetched all employees successfully',
                data: data
            });
        })
        .catch(error => {
            console.error("Error fetching data:", error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch employees',
                error: error.message || error
            });
        });
});

router.post('/add', authToken, async (req, res) => {
    const { first_name, last_name, dob, employment_date } = req.body;
    // Używamy tekstu zapytania z bezpośrednimi parametrami
    const query =  'INSERT INTO employees (first_name, last_name, dob, employment_date) VALUES ($1, $2, $3, $4) RETURNING *'
    const values =  [first_name, last_name, dob, employment_date]; ;
    try {
        const data = await db.one(query,values);
        res.json({
            status: 'success',
            message: 'Employee added successfully!',
            data: data
        });
    } catch (error) {
        console.error("Error inserting data:", error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to add employee.',
            error: error.message || error
        });
    }
});

router.delete('/delete/:id', authToken, async (req, res) => {
    const employeeId = req.params.id;
    
    db.result('DELETE FROM employees WHERE employee_id = $1', [employeeId])
        .then(result => {
            if (result.rowCount > 0) {
                res.json({
                    status: 'success',
                    message: 'Employee deleted successfully',
                    deletedCount: result.rowCount
                });
            } else {
                res.status(404).json({
                    status: 'error',
                    message: 'Employee not found'
                });
            }
        })
        .catch(error => {
            console.error("Error deleting Employee:", error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to delete Employee',
                error: error.message || error
            });
        });
});

router.put('/update/', authToken, async (req, res) => {
    const employeeId = req.user.id;
    const updates = req.body;

    try {
        const allowedFields = ['first_name', 'last_name', 'keycard_id'];
        const fields = Object.keys(updates).filter(field => allowedFields.includes(field));
        if (fields.length > 0) {
            const setStatements = fields.map((field, index) => `${field} = $${index + 1}`);
            const query = `UPDATE employees SET ${setStatements.join(', ')} WHERE id = $${fields.length + 1} RETURNING *`;
            const values = [...fields.map(field => updates[field]), employeeId];
            const updatedEmployee = await db.one(query, values);
            return res.json({
                status: 'success',
                message: 'Employee updated successfully',
                data: updatedEmployee
            });
        }

        // Jeśli nie było żadnych pól do aktualizacji
        if (!updates.current_password && !updates.new_password && fields.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No valid fields to update'
            });
        }
    } catch (error) {
        console.error("Error updating employee:", error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update employee',
            error: error.message || error
        });
    }
});


module.exports = {
   path: '/employees',
    router,
    routeName: 'employees' 
}