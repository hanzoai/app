export const config = {
    //
    // ====================
    // Runner Configuration
    // ====================
    runner: 'local',
    
    //
    // ==================
    // Specify Test Files
    // ==================
    specs: [
        './tests/specs/**/*.js'
    ],
    exclude: [],

    //
    // ============
    // Capabilities
    // ============
    maxInstances: 1,
    capabilities: [{
        // Using Chrome/Chromium for desktop app testing via DevTools
        browserName: 'chrome',
        'goog:chromeOptions': {
            // Connect to Tauri app via Chrome DevTools Protocol
            debuggerAddress: 'localhost:9222',
            args: ['--remote-debugging-port=9222']
        }
    }],

    //
    // ===================
    // Test Configurations
    // ===================
    logLevel: 'info',
    bail: 0,
    baseUrl: 'http://localhost:1420', // Tauri dev server
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    
    //
    // ====
    // Services
    // ====
    services: [],

    framework: 'mocha',
    reporters: ['spec'],
    
    //
    // =====
    // Hooks
    // =====
    /**
     * Gets executed once before all workers get launched.
     */
    onPrepare: function (config, capabilities) {
        console.log('Starting Tauri WebDriver test suite...')
    },

    /**
     * Gets executed before a worker process is spawned and can be used to initialize specific service
     * for that worker as well as modify runtime environments in an async fashion.
     */
    onWorkerStart: function (cid, caps, specs, args, execArgv) {
        // Worker initialization
    },

    /**
     * Gets executed just before initialising the webdriver session and test framework. It allows you
     * to manipulate configurations depending on the capability or spec.
     */
    beforeSession: function (config, capabilities, specs) {
        // Session setup
    },

    /**
     * Gets executed before test execution begins. At this point you can access to all global
     * variables like `browser`. It is the perfect place to define custom commands.
     */
    before: function (capabilities, specs) {
        // Global setup
    },

    /**
     * Runs before a WebdriverIO command gets executed.
     */
    beforeCommand: function (commandName, args) {
        // Command logging
    },

    /**
     * Runs after a WebdriverIO command gets executed
     */
    afterCommand: function (commandName, args, result, error) {
        // Command result handling
    },

    /**
     * Gets executed after all tests are done. You still have access to all global variables from
     * the test.
     */
    after: function (result, capabilities, specs) {
        // Cleanup
    },

    /**
     * Gets executed right after terminating the webdriver session.
     */
    afterSession: function (config, capabilities, specs) {
        // Session cleanup
    },

    /**
     * Gets executed after all workers got shut down and the process is about to exit. An error
     * thrown in the onComplete hook will result in the test run failing.
     */
    onComplete: function(exitCode, config, capabilities, results) {
        console.log('Tauri WebDriver test suite completed!')
    },

    /**
    * Gets executed when a refresh happens.
    */
    onReload: function(oldSessionId, newSessionId) {
        // Session reload handling
    }
}