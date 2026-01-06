const express = require('express');
const router = express.Router();
const authToken = require('../../middleware/authMiddleware/authToken');
const db = require('../../modules/dbModules/db');
const logger = require('../../logger');
const statsScheduler = require('../../services/statsService/statsScheduler');

// Statystyki dzienne (ostatnie 7 dni)
router.get('/daily', authToken('HR'), async (req, res) => {
    try {
        const data = await db.any(`
            SELECT 
                work_date as date,
                total_hours,
                avg_hours,
                sessions_count,
                unique_employees
            FROM daily_work_stats 
            WHERE work_date >= CURRENT_DATE - INTERVAL '7 days'
            ORDER BY work_date ASC
        `);
        
        // Formatuj daty dla lepszego wyświetlania
        const formattedData = data.map(row => ({
            ...row,
            date: new Date(row.date).toLocaleDateString('pl-PL', { 
                month: 'short', 
                day: 'numeric' 
            }),
            total_hours: parseFloat(row.total_hours) || 0,
            avg_hours: parseFloat(row.avg_hours) || 0
        }));
        
        res.json({ status: 'success', data: formattedData });
    } catch (error) {
        logger.error(`Error in daily stats:`, error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Statystyki tygodniowe
router.get('/weekly', authToken('HR'), async (req, res) => {
    try {
        const data = await db.any(`
            SELECT 
                day_number,
                day_name,
                total_hours,
                sessions_count,
                unique_employees
            FROM weekly_work_stats
        `);
        
        // Zapewnij wszystkie dni tygodnia (1-5 dla dni roboczych)
        const workDays = [
            { day_number: 1, day_name: 'Poniedziałek' },
            { day_number: 2, day_name: 'Wtorek' },
            { day_number: 3, day_name: 'Środa' },
            { day_number: 4, day_name: 'Czwartek' },
            { day_number: 5, day_name: 'Piątek' }
        ];
        
        const formattedData = workDays.map(day => {
            const dayData = data.find(d => d.day_number === day.day_number);
            return {
                day_name: day.day_name,
                total_hours: dayData ? parseFloat(dayData.total_hours) : 0,
                sessions_count: dayData ? parseInt(dayData.sessions_count) : 0,
                unique_employees: dayData ? parseInt(dayData.unique_employees) : 0
            };
        });
        
        res.json({ status: 'success', data: formattedData });
    } catch (error) {
        logger.error(`Error in weekly stats:`, error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Statystyki miesięczne (po tygodniach)
router.get('/monthly', authToken('HR'), async (req, res) => {
    try {
        const data = await db.any(`
            SELECT 
                week_start as date,
                week_label,
                total_hours,
                avg_hours,
                sessions_count,
                unique_employees
            FROM monthly_work_stats
            LIMIT 4
        `);
        
        const formattedData = data.map(row => ({
            ...row,
            date: row.week_label,
            total_hours: parseFloat(row.total_hours) || 0,
            avg_hours: parseFloat(row.avg_hours) || 0
        }));
        
        res.json({ status: 'success', data: formattedData });
    } catch (error) {
        logger.error(`Error in monthly stats:`, error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Aktualnie pracujący
router.get('/current-employees', authToken('HR'), async (req, res) => {
    try {
        const data = await db.any(`
            SELECT 
                employee_id,
                employee_name,
                department_name,
                job_title,
                is_working,
                shift_start,
                hours_today
            FROM current_working_employees
        `);
        
        res.json({ status: 'success', data });
    } catch (error) {
        logger.error(`Error in current-employees:`, error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Nieobecni pracownicy (wszyscy którzy nie pracują teraz)
router.get('/absent-employees', authToken('HR'), async (req, res) => {
    try {
        // Jeśli widok absent_employees istnieje, użyj go
        // Jeśli nie - zapytanie działa bezpośrednio
        const data = await db.any(`
            SELECT * FROM absent_employees
            ORDER BY last_seen DESC NULLS LAST
        `);
        
        res.json({ status: 'success', data });
    } catch (error) {
        logger.error(`Error in absent-employees:`, error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Wszyscy pracownicy z ich statusem (pracuje/nieobecny)
router.get('/all-employees-status', authToken('HR'), async (req, res) => {
    try {
        const data = await db.any(`
            SELECT * FROM all_employees_status
            ORDER BY is_working DESC, shift_start DESC NULLS LAST, last_seen DESC NULLS LAST
        `);
        
        res.json({ status: 'success', data });
    } catch (error) {
        logger.error(`Error in all-employees-status:`, error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});


module.exports = {
   path: '/work-stats',
    router,
    routeName: 'workStats'
}