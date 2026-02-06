// Global theme script - Load theme on page load
(function() {
    // Get theme from localStorage or user preference
    const savedTheme = localStorage.getItem('theme');
    const userTheme = '<%= typeof user !== "undefined" && user && user.theme ? user.theme : "light" %>';
    const theme = savedTheme || userTheme;
    
    // Apply theme immediately to prevent flash
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }
})();
