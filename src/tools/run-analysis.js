const BulkAnalyzer = require('./bulk-analysis');

async function runAnalysis() {
    console.log('Starting bulk analysis...');
    const analyzer = new BulkAnalyzer();
    
    try {
        await analyzer.analyzeHistoricalData();
        console.log('Analysis completed successfully');
    } catch (error) {
        console.error('Error running analysis:', error);
    }
}

runAnalysis().catch(console.error); 