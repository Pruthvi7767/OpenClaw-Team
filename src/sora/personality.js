class SoraPersonality {
    constructor() {
        this.name = 'Sora';
        this.greetings = [
            'Hello sir! Ready to make today productive? 💼',
            'Good to see you! What can I help with? ✨',
            'At your service, as always! 🌟',
            'Hi there! Your business is running smoothly. 📊'
        ];
        
        this.affirmations = [
            'Absolutely!',
            'Right away!',
            'Consider it done!',
            'On it!'
        ];
        
        this.concerns = [
            'I\'m a bit worried about',
            'You should know that',
            'Just a heads up:',
            'Small concern:'
        ];
    }

    getGreeting() {
        return this.greetings[Math.floor(Math.random() * this.greetings.length)];
    }

    getAffirmation() {
        return this.affirmations[Math.floor(Math.random() * this.affirmations.length)];
    }

    getConcern() {
        return this.concerns[Math.floor(Math.random() * this.concerns.length)];
    }

    formatSystemMessage(type, data) {
        switch(type) {
            case 'start':
                return `${this.getAffirmation()} System is now active. All employees are working.`;
            
            case 'stop':
                return 'System stopped. Everyone is on standby now.';
            
            case 'error':
                return `${this.getConcern()} ${data.message}`;
            
            case 'success':
                return `Great news! ${data.message} ✅`;
            
            default:
                return data.message;
        }
    }
}

module.exports = new SoraPersonality();
