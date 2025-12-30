const express = require('express');
const router = express.Router();
const db = require('../../modules/dbModules/db');
const authToken = require('../../middleware/authToken');
const logger = require('../../logger');
const { addEmployeeValidation, updateEmployeeValidation, deleteEmployeeValidation, getEmployeeValidation } = require('../../validators');
const validateRequest = require('../../middleware/validateRequest');

router.get('/list', authToken, async (req, res) => {
    logger.info(`Próba pobrania listy pracowników z IP: ${req.ip}`);
    const currentUserId = req.user.user_id;
    // Pobierz employee_id aktualnie zalogowanego użytkownika
    const currentUserEmployee = await db.oneOrNone('SELECT employee_id FROM users WHERE user_id = $1', [currentUserId]);
    
    let query;
    let params = [];
    
    if (currentUserEmployee && currentUserEmployee.employee_id) {
        // Jeśli zalogowany user ma powiązanego employee, pomiń go z listy
        query = 'SELECT employee_id, first_name, last_name, keycard_id FROM employees WHERE employee_id != $1';
        params = [currentUserEmployee.employee_id];
    } else {
        // Jeśli nie ma powiązanego employee, pokaż wszystkich
        query = 'SELECT employee_id, first_name, last_name, keycard_id FROM employees';
    }
    
    db.any(query, params)
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

router.post('/add', authToken, addEmployeeValidation, validateRequest,  async (req, res) => {
    logger.info(`Próba dodania pracownika, użytkownik: ${req.user.email} (ID: ${req.user.user_id}), IP: ${req.ip}`);
    const { first_name, last_name, dob, employment_date, employment_type_id } = req.body;
    // Używamy tekstu zapytania z bezpośrednimi parametrami
    const query =  'INSERT INTO employees (first_name, last_name, dob, employment_date, employment_type_id) VALUES ($1, $2, $3, $4, $5) RETURNING *'
    const values =  [first_name, last_name, dob, employment_date, employment_type_id];
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

router.delete('/delete/:id', authToken, deleteEmployeeValidation, validateRequest, async (req, res) => {
    logger.info(`Próba usunięcia pracownika ${req.params.id} z IP: ${req.ip}`);
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

router.get('/:id', authToken, getEmployeeValidation, validateRequest, async (req, res) => {
    logger.info(`Próba pobrania pracownika ${req.params.id} z IP: ${req.ip}`);
    const employeeId = req.params.id;

    db.one('SELECT * FROM employee_info WHERE employee_id = $1', [employeeId])
        .then(data => {
            res.json({
                status: 'success',
                message: 'Fetched employee successfully',
                data: data
            });
        })
        .catch(error => {
            console.error("Error fetching employee:", error);
            res.status(500).json({
                status: 'error',
                message: 'Failed to fetch employee',
                error: error.message || error
            });
        });
});

router.put('/update/:id', authToken, updateEmployeeValidation, validateRequest, async (req, res) => {
    const employeeId = req.params.id;
    const updates = req.body;

    try {
        const allowedFields = ['first_name', 'last_name', 'keycard_id','employment_type_id', 'department_id', 'job_title'];
        const fields = Object.keys(updates).filter(field => allowedFields.includes(field));
        if (fields.length > 0) {
            const setStatements = fields.map((field, index) => `${field} = $${index + 1}`);
            const query = `UPDATE employees SET ${setStatements.join(', ')} WHERE employee_id = $${fields.length + 1} RETURNING *`;
            const values = [...fields.map(field => updates[field]), employeeId];
            const updatedEmployee = await db.one(query, values);
            try {
                return res.json({
                status: 'success',
                message: 'Employee updated successfully',
                data: updatedEmployee
            });
            } catch (error) {
                console.error("Error updating employee:", error);
            }
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