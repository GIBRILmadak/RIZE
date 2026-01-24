/* ========================================
   SYSTÈME D'ANALYTICS ET DASHBOARD
   ======================================== */

let analyticsChart = null;
let streakChart = null;

// Récupérer les statistiques d'un utilisateur
async function getUserStatistics(userId) {
    try {
        const { data, error } = await supabase
            .from('user_statistics')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (error) throw error;
        
        return { success: true, stats: data };
        
    } catch (error) {
        console.error('Erreur récupération stats:', error);
        return { success: false, error: error.message };
    }
}

// Récupérer les métriques quotidiennes
async function getDailyMetrics(userId, days = 30) {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const { data, error } = await supabase
            .from('daily_metrics')
            .select('*')
            .eq('user_id', userId)
            .gte('date', startDate.toISOString().split('T')[0])
            .order('date', { ascending: true });
        
        if (error) throw error;
        
        return { success: true, metrics: data };
        
    } catch (error) {
        console.error('Erreur récupération métriques:', error);
        return { success: false, error: error.message };
    }
}

// Récupérer le streak actuel
async function getUserStreak(userId) {
    try {
        const { data, error } = await supabase
            .from('user_streaks')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        return { 
            success: true, 
            streak: data || { current_streak: 0, longest_streak: 0 }
        };
        
    } catch (error) {
        console.error('Erreur récupération streak:', error);
        return { success: false, error: error.message };
    }
}

// Rendre le dashboard analytics
async function renderAnalyticsDashboard(userId) {
    const container = document.getElementById('analytics-dashboard');
    if (!container) return;
    
    // Afficher un loader
    container.innerHTML = '<div class="analytics-loader">Chargement des statistiques...</div>';
    
    try {
        // Charger toutes les données
        const [statsResult, metricsResult, streakResult] = await Promise.all([
            getUserStatistics(userId),
            getDailyMetrics(userId, 30),
            getUserStreak(userId)
        ]);
        
        if (!statsResult.success || !metricsResult.success || !streakResult.success) {
            throw new Error('Erreur chargement données');
        }
        
        const stats = statsResult.stats;
        const metrics = metricsResult.metrics;
        const streak = streakResult.streak;
        
        // Générer le HTML
        container.innerHTML = `
            <div class="analytics-header">
                <h2>Tableau de Bord Analytics</h2>
                <p>Analyse de votre progression sur les 30 derniers jours</p>
            </div>
            
            <div class="analytics-stats-grid">
                <div class="analytics-stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-value">${stats.total_posts || 0}</div>
                    <div class="stat-label">Posts Totaux</div>
                </div>
                
                <div class="analytics-stat-card success">
                    <div class="stat-icon">✅</div>
                    <div class="stat-value">${stats.success_count || 0}</div>
                    <div class="stat-label">Succès</div>
                </div>
                
                <div class="analytics-stat-card failure">
                    <div class="stat-icon">❌</div>
                    <div class="stat-value">${stats.failure_count || 0}</div>
                    <div class="stat-label">Échecs</div>
                </div>
                
                <div class="analytics-stat-card">
                    <div class="stat-icon">📈</div>
                    <div class="stat-value">${stats.success_rate || 0}%</div>
                    <div class="stat-label">Taux de Succès</div>
                </div>
                
                <div class="analytics-stat-card streak">
                    <div class="stat-icon">🔥</div>
                    <div class="stat-value">${streak.current_streak || 0}</div>
                    <div class="stat-label">Streak Actuel</div>
                </div>
                
                <div class="analytics-stat-card">
                    <div class="stat-icon">🏆</div>
                    <div class="stat-value">${streak.longest_streak || 0}</div>
                    <div class="stat-label">Meilleur Streak</div>
                </div>
                
                <div class="analytics-stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-value">${stats.followers_count || 0}</div>
                    <div class="stat-label">Abonnés</div>
                </div>
                
                <div class="analytics-stat-card">
                    <div class="stat-icon">👤</div>
                    <div class="stat-value">${stats.following_count || 0}</div>
                    <div class="stat-label">Abonnements</div>
                </div>
            </div>
            
            <div class="analytics-charts">
                <div class="analytics-chart-container">
                    <h3>Progression sur 30 jours</h3>
                    <canvas id="analytics-progress-chart"></canvas>
                </div>
                
                <div class="analytics-chart-container">
                    <h3>Répartition Succès/Échecs</h3>
                    <canvas id="analytics-pie-chart"></canvas>
                </div>
            </div>
        `;
        
        // Créer les graphiques
        createProgressChart(metrics);
        createPieChart(stats);
        
    } catch (error) {
        console.error('Erreur rendu dashboard:', error);
        container.innerHTML = `
            <div class="analytics-error">
                <p>Erreur lors du chargement des statistiques</p>
                <button onclick="renderAnalyticsDashboard('${userId}')">Réessayer</button>
            </div>
        `;
    }
}

// Créer le graphique de progression
function createProgressChart(metrics) {
    const canvas = document.getElementById('analytics-progress-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Détruire le graphique existant
    if (analyticsChart) {
        analyticsChart.destroy();
    }
    
    // Préparer les données
    const labels = metrics.map(m => {
        const date = new Date(m.date);
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    });
    
    const successData = metrics.map(m => m.success_count);
    const failureData = metrics.map(m => m.failure_count);
    const pauseData = metrics.map(m => m.pause_count);
    
    // Créer le graphique
    analyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Succès',
                    data: successData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Échecs',
                    data: failureData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Pauses',
                    data: pauseData,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#f5f5f5',
                        font: {
                            family: 'Inter',
                            size: 12
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#f5f5f5',
                    bodyColor: '#f5f5f5',
                    borderColor: '#333',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#888',
                        font: {
                            family: 'Inter'
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        color: '#888',
                        font: {
                            family: 'Inter'
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    }
                }
            }
        }
    });
}

// Créer le graphique en camembert
function createPieChart(stats) {
    const canvas = document.getElementById('analytics-pie-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Détruire le graphique existant
    if (streakChart) {
        streakChart.destroy();
    }
    
    // Créer le graphique
    streakChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Succès', 'Échecs', 'Pauses'],
            datasets: [{
                data: [
                    stats.success_count || 0,
                    stats.failure_count || 0,
                    stats.pause_count || 0
                ],
                backgroundColor: [
                    '#10b981',
                    '#ef4444',
                    '#6366f1'
                ],
                borderColor: '#0a0a0a',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: '#f5f5f5',
                        font: {
                            family: 'Inter',
                            size: 12
                        },
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#f5f5f5',
                    bodyColor: '#f5f5f5',
                    borderColor: '#333',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Exporter les données analytics en CSV
function exportAnalyticsCSV(userId) {
    getDailyMetrics(userId, 365).then(result => {
        if (!result.success) {
            alert('Erreur lors de l\'export');
            return;
        }
        
        const metrics = result.metrics;
        
        // Créer le CSV
        let csv = 'Date,Posts,Succès,Échecs,Pauses\n';
        metrics.forEach(m => {
            csv += `${m.date},${m.posts_count},${m.success_count},${m.failure_count},${m.pause_count}\n`;
        });
        
        // Télécharger
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${userId}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    });
}
