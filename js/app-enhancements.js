/* ========================================
   AMÉLIORATIONS GLOBALES APP - RIZE
   Navigation fluide, feedbacks visuels, interactions
   ======================================== */

// Gestionnaire de navigation avec améliorations
class NavigationEnhancer {
    static init() {
        this.enhanceNavigation();
        this.addScrollEffects();
        this.addPageTransitions();
    }
    
    static enhanceNavigation() {
        // Améliorer tous les liens de navigation
        const navLinks = document.querySelectorAll('nav a, .nav-links a');
        navLinks.forEach(link => {
            if (!link.onclick) { // Éviter de modifier les liens avec déjà une fonction onclick
                link.addEventListener('click', this.handleNavClick.bind(this));
            }
        });
        
        // Observer les changements d'URL pour les animations de page
        this.currentPage = this.getCurrentPage();
        this.observePageChanges();
    }
    
    static handleNavClick(e) {
        const link = e.currentTarget;
        
        // Ajouter un effet de feedback visuel
        this.addClickFeedback(link);
        
        // Animation de transition
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
            e.preventDefault();
            this.smoothScrollToSection(href.substring(1));
        }
    }
    
    static addClickFeedback(element) {
        element.style.transform = 'scale(0.95)';
        element.style.transition = 'transform 0.1s ease';
        
        setTimeout(() => {
            element.style.transform = 'scale(1)';
            element.style.transition = 'transform 0.2s cubic-bezier(0.23, 1, 0.32, 1)';
        }, 100);
    }
    
    static smoothScrollToSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            // Masquer la section actuelle en fondu
            const currentSection = document.querySelector('.page.active');
            if (currentSection && currentSection !== section) {
                currentSection.style.opacity = '0';
                currentSection.style.transform = 'translateY(-20px)';
                
                setTimeout(() => {
                    currentSection.classList.remove('active');
                    section.classList.add('active');
                    section.style.opacity = '0';
                    section.style.transform = 'translateY(20px)';
                    
                    // Animation d'entrée
                    requestAnimationFrame(() => {
                        section.style.transition = 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
                        section.style.opacity = '1';
                        section.style.transform = 'translateY(0)';
                    });
                }, 200);
            } else if (!currentSection) {
                section.classList.add('active');
                AnimationManager.slideUp(section);
            }
        }
    }
    
    static addScrollEffects() {
        // Parallax subtil pour les éléments
        let ticking = false;
        
        function updateScrollEffects() {
            const scrollY = window.scrollY;
            
            ticking = false;
        }
        
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(updateScrollEffects);
                ticking = true;
            }
        });
    }
    
    static addPageTransitions() {
        // Intercepter les appels à navigateTo pour ajouter des transitions
        const originalNavigateTo = window.navigateTo;
        
        window.navigateTo = (pageId) => {
            const currentPage = document.querySelector('.page.active');
            const nextPage = document.getElementById(pageId);
            
            if (currentPage && nextPage && currentPage !== nextPage) {
                // Animation de sortie
                currentPage.style.transform = 'scale(0.98) translateX(-20px)';
                currentPage.style.opacity = '0.8';
                currentPage.style.transition = 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
                
                setTimeout(() => {
                    if (originalNavigateTo) {
                        originalNavigateTo(pageId);
                    } else {
                        // Fallback simple
                        currentPage.classList.remove('active');
                        nextPage.classList.add('active');
                    }
                    
                    // Animation d'entrée
                    nextPage.style.transform = 'scale(1.02) translateX(20px)';
                    nextPage.style.opacity = '0.8';
                    
                    requestAnimationFrame(() => {
                        nextPage.style.transition = 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)';
                        nextPage.style.transform = 'scale(1) translateX(0)';
                        nextPage.style.opacity = '1';
                    });
                }, 150);
            } else {
                // Pas de transition, utiliser la fonction originale
                if (originalNavigateTo) {
                    originalNavigateTo(pageId);
                }
            }
        };
    }
    
    static getCurrentPage() {
        const activePage = document.querySelector('.page.active');
        return activePage ? activePage.id : null;
    }
    
    static observePageChanges() {
        // Observer les changements de page active pour des animations
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList.contains('page') && target.classList.contains('active')) {
                        this.onPageActivated(target);
                    }
                }
            });
        });
        
        document.querySelectorAll('.page').forEach(page => {
            observer.observe(page, { attributes: true });
        });
    }
    
    static onPageActivated(page) {
        // Animer les éléments de la page nouvellement activée
        const cards = page.querySelectorAll('.discover-card');
        const contentItems = page.querySelectorAll('.content-item, .timeline-item');

        LoadingFeedback.clearAll();
        
        if (cards.length > 0) {
            AnimationManager.fadeInElements(cards, 100);
        }
        
        if (contentItems.length > 0) {
            AnimationManager.fadeInElements(contentItems, 80);
        }
    }
}

// Gestionnaire d'interactions améliorées
class InteractionEnhancer {
    static init() {
        this.enhanceButtons();
        this.addHoverEffects();
        this.addFocusManagement();
    }
    
    static enhanceButtons() {
        // Intercepter tous les clics de boutons pour ajouter des feedbacks
        // MAIS ne pas interférer avec les fonctionnalités critiques
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button, .btn');
            if (button && !button.disabled) {
                // Ne pas intercepter les boutons avec des onclick critiques
                const onclick = button.getAttribute('onclick');
                if (onclick && (
                    onclick.includes('launchLive') || 
                    onclick.includes('openSettings') || 
                    onclick.includes('toggleFollow')
                )) {
                    // Juste l'effet visuel, ne pas interférer
                    setTimeout(() => this.addButtonFeedback(button), 0);
                } else {
                    this.addButtonFeedback(button);
                }
            }
        });
        
        // Ajouter des effets keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const focused = document.activeElement;
                if (focused && (focused.tagName === 'BUTTON' || focused.classList.contains('btn'))) {
                    this.addButtonFeedback(focused);
                }
            }
        });
    }
    
    static addButtonFeedback(button) {
        // Éviter les feedbacks multiples
        if (button.classList.contains('feedback-active')) return;
        
        button.classList.add('feedback-active');
        
        // Effet de pression
        const originalTransform = button.style.transform;
        button.style.transform = 'scale(0.95)';
        button.style.transition = 'transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1)';
        
        setTimeout(() => {
            button.style.transform = originalTransform || 'scale(1)';
            button.style.transition = 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
            
            setTimeout(() => {
                button.classList.remove('feedback-active');
            }, 300);
        }, 100);
    }
    
    static addHoverEffects() {
        // Ajouter des effets de survol dynamiques
        const style = document.createElement('style');
        style.textContent = `
            .discover-card {
                transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                will-change: transform, box-shadow;
            }
            
            .discover-card:hover {
                transform: translateY(-8px);
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }
            
            .btn:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(255, 255, 255, 0.1);
            }
            
            nav a:hover {
                transform: translateY(-1px);
                transition: transform 0.2s ease;
            }
            
            .timeline-item:hover {
                transform: translateX(5px);
                transition: transform 0.3s ease;
            }
        `;
        document.head.appendChild(style);
    }
    
    static addFocusManagement() {
        // Améliorer la gestion du focus pour l'accessibilité
        let isKeyboardUser = false;
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                isKeyboardUser = true;
                document.body.classList.add('keyboard-user');
            }
        });
        
        document.addEventListener('mousedown', () => {
            isKeyboardUser = false;
            document.body.classList.remove('keyboard-user');
        });
        
        // Focus visible only for keyboard users
        const focusStyle = document.createElement('style');
        focusStyle.textContent = `
            body:not(.keyboard-user) button:focus,
            body:not(.keyboard-user) .btn:focus {
                outline: none;
            }
            
            .keyboard-user button:focus,
            .keyboard-user .btn:focus {
                outline: 2px solid var(--accent-color);
                outline-offset: 2px;
            }
        `;
        document.head.appendChild(focusStyle);
    }
}

// Feedback de chargement léger sur clics
class LoadingFeedback {
    static activeElements = new Set();
    static timeouts = new Map();
    static fallbackDuration = 2200;
    static buttonDuration = 700;

    static init() {
        this.addNavigationClickFeedback();
        this.addUserProfileClickFeedback();
        this.addButtonClickFeedback();
    }

    static addNavigationClickFeedback() {
        document.addEventListener('click', (e) => {
            const onclickTarget = e.target.closest('[onclick*="navigateTo("], [onclick*="handleProfileNavigation"], [onclick*="navigateToUserProfile"], [onclick*="window.location"], [onclick*="location.href"]');
            const link = e.target.closest('a[href]');
            const href = link ? link.getAttribute('href') : null;
            const isRealLink = href && href !== '#' && !href.startsWith('#') && !href.startsWith('javascript:');
            const target = onclickTarget || (isRealLink ? link : null);

            if (!target) return;
            if (target.closest('button') || target.classList.contains('btn')) return;

            this.setLoading(target, {
                persistent: true,
                showSpinner: true
            });
        });
    }

    static addUserProfileClickFeedback() {
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[onclick*="navigateToUserProfile"]');
            if (!target) return;
            this.setLoading(target, { persistent: true, showSpinner: true });
        });
    }

    static addButtonClickFeedback() {
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button, .btn');
            if (!button || button.disabled) return;
            if (button.classList.contains('btn-loading')) return;
            const onclick = button.getAttribute('onclick') || '';
            const isNavigationAction = (
                onclick.includes('navigateTo(') ||
                onclick.includes('handleProfileNavigation') ||
                onclick.includes('navigateToUserProfile') ||
                onclick.includes('window.location') ||
                onclick.includes('location.href')
            );
            this.setLoading(button, {
                persistent: isNavigationAction,
                duration: isNavigationAction ? this.fallbackDuration : this.buttonDuration,
                buttonSpinner: isNavigationAction
            });
        });
    }

    static setLoading(element, { persistent = false, duration = this.fallbackDuration, showSpinner = false, buttonSpinner = false } = {}) {
        if (!element || element.classList.contains('click-loading')) return;
        element.classList.add('click-loading');
        if (showSpinner) {
            element.classList.add('click-loading-indicator');
        }
        if (buttonSpinner) {
            this.applyButtonSpinner(element);
        }
        this.activeElements.add(element);

        const timeout = setTimeout(() => {
            this.clearElement(element);
        }, persistent ? this.fallbackDuration : duration);

        this.timeouts.set(element, timeout);
    }

    static clearElement(element) {
        if (!element) return;
        element.classList.remove('click-loading');
        element.classList.remove('click-loading-indicator');
        this.removeButtonSpinner(element);
        this.activeElements.delete(element);
        const timeout = this.timeouts.get(element);
        if (timeout) {
            clearTimeout(timeout);
            this.timeouts.delete(element);
        }
    }

    static clearAll() {
        this.activeElements.forEach((element) => this.clearElement(element));
    }

    static applyButtonSpinner(button) {
        if (!button || button.classList.contains('btn-loading')) return;
        button.classList.add('btn-loading');

        let spinner = button.querySelector('.loading-spinner');
        if (!spinner) {
            spinner = document.createElement('span');
            spinner.className = 'loading-spinner temp-loading-spinner';
            button.appendChild(spinner);
        }
    }

    static removeButtonSpinner(button) {
        if (!button) return;
        button.classList.remove('btn-loading');
        const tempSpinner = button.querySelector('.temp-loading-spinner');
        if (tempSpinner) {
            tempSpinner.remove();
        }
    }
}

// Gestionnaire de performance pour les animations
class PerformanceOptimizer {
    static init() {
        this.optimizeAnimations();
        this.manageResources();
    }
    
    static optimizeAnimations() {
        // Réduire les animations si l'utilisateur préfère un mouvement réduit
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        if (prefersReducedMotion) {
            const style = document.createElement('style');
            style.textContent = `
                *, *::before, *::after {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    static manageResources() {
        // Lazy loading des images
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            imageObserver.unobserve(img);
                        }
                    }
                });
            });
            
            // Observer les images avec data-src
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }
}

// Initialisation automatique
document.addEventListener('DOMContentLoaded', () => {
    NavigationEnhancer.init();
    InteractionEnhancer.init();
    LoadingFeedback.init();
    PerformanceOptimizer.init();
    
    // Ajouter un délai pour s'assurer que tous les autres scripts sont chargés
    setTimeout(() => {
        // Animer la page initiale
        const activePage = document.querySelector('.page.active');
        if (activePage) {
            AnimationManager.fadeInElements('.page.active .discover-card, .page.active .content-item', 100);
        }
    }, 500);
});

// Export global
window.NavigationEnhancer = NavigationEnhancer;
window.InteractionEnhancer = InteractionEnhancer;
window.PerformanceOptimizer = PerformanceOptimizer;
