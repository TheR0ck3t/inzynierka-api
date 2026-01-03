const cron = require('node-cron');
const db = require('../../modules/dbModules/db');
const logger = require('../../logger');

let jobs = [];
let isInitialized = false;

// Odświeżanie widoków statystyk
async function refreshStatsViews() {
    try {
        const startTime = Date.now();
        const results = await db.any(`SELECT * FROM refresh_work_stats_views()`);
        const totalTime = Date.now() - startTime;
        
        logger.info(`[CRON] Odświeżono widoki statystyk czas odświeżenia: ${totalTime}ms`);
    } catch (error) {
        logger.error('[CRON] Błąd podczas odświeżania widoków statystyk:', error);
    }
}

// Zamykanie wygasłych sesji
async function closeExpiredSessions() {
    try {
        const result = await db.one(`SELECT * FROM close_expired_sessions(24)`);
        
        if (result.closed_count > 0) {
            logger.warn(
                `[CRON] Zamknięto ${result.closed_count} wygasłych sesji (>24h)`
            );
        } else {
            logger.info('[CRON] Brak wygasłych sesji do zamknięcia');
        }
    } catch (error) {
        logger.error('[CRON] Błąd podczas zamykania wygasłych sesji:', error);
    }
}

// Czyszczenie starych logów
async function cleanupOldLogs() {
    try {
        const result = await db.one(`SELECT * FROM cleanup_old_access_logs(90)`);
        
        if (result.deleted_count > 0) {
            logger.info(
                `[CRON] Usunięto ${result.deleted_count} starych logów dostępu (>90 dni)`
            );
        } else {
            logger.info('[CRON] Brak starych logów do usunięcia');
        }
    } catch (error) {
        logger.error('[CRON] Błąd podczas usuwania starych logów:', error);
    }
}

// Inicjalizacja wszystkich scheduled jobs
function init() {
    if (isInitialized) {
        logger.warn('[StatsScheduler] Już zainicjalizowano');
        return;
    }

    logger.info('[StatsScheduler] Inicjalizacja scheduled jobs...');

    // Co 5 minut - odśwież widoki statystyk
    jobs.push(
        cron.schedule('*/5 * * * *', async () => {
            await refreshStatsViews();
        }, {
            scheduled: true,
            timezone: "Europe/Warsaw"
        })
    );

    // Co dzień o 00:00 - zamknij wygasłe sesje
    jobs.push(
        cron.schedule('0 0 * * *', async () => {
            await closeExpiredSessions();
        }, {
            scheduled: true,
            timezone: "Europe/Warsaw"
        })
    );

    // Co tydzień w niedzielę o 02:00 - wyczyść stare logi (90 dni)
    jobs.push(
        cron.schedule('0 2 * * 0', async () => {
            await cleanupOldLogs();
        }, {
            scheduled: true,
            timezone: "Europe/Warsaw"
        })
    );

    isInitialized = true;
    logger.info(`[StatsScheduler] ${jobs.length} scheduled jobs uruchomionych`);
}

// Zatrzymanie wszystkich jobs (przy graceful shutdown)
function stop() {
    logger.info('[StatsScheduler] Zatrzymywanie wszystkich zaplanowanych zadań...');
    jobs.forEach(job => job.stop());
    logger.info('[StatsScheduler] Wszystkie zadania zatrzymane');
}

// Natychmiastowe odświeżenie (dla testów lub manual trigger)
async function forceRefresh() {
    logger.info('[StatsScheduler] Wymuszone odświeżenie wywołane ręcznie');
    await refreshStatsViews();
}

// Informacje o statusie schedulera
function getStatus() {
    return {
        total_jobs: jobs.length,
        is_initialized: isInitialized,
        jobs: [
            {
                name: 'refresh_stats_views',
                schedule: '*/5 * * * *',
                description: 'Odświeża widoki statystyk co 5 minut'
            },
            {
                name: 'close_expired_sessions',
                schedule: '0 0 * * *',
                description: 'Zamyka sesje otwarte >24h (codziennie o północy)'
            },
            {
                name: 'cleanup_old_logs',
                schedule: '0 2 * * 0',
                description: 'Usuwa logi starsze niż 90 dni (niedziela 02:00)'
            }
        ]
    };
}

module.exports = {
    init,
    stop,
    forceRefresh,
    getStatus,
    refreshStatsViews,
    closeExpiredSessions,
    cleanupOldLogs
};
