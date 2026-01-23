import { generateAllWeeklyReports, generateWeeklyReport, listReports } from '../services/report-generator.js';

const args = process.argv.slice(2);
const command = args[0];

function showHelp(): void {
  console.log(`
Prymo Monitora - Report Generator

Usage:
  npx tsx src/scripts/generate-reports.ts <command> [options]

Commands:
  all                 Generate reports for all clients (current week)
  client <name>       Generate report for a specific client
  list                List all generated reports
  help                Show this help message

Examples:
  npx tsx src/scripts/generate-reports.ts all
  npx tsx src/scripts/generate-reports.ts client "Luana Carolina"
  npx tsx src/scripts/generate-reports.ts list
`);
}

async function main(): Promise<void> {
  switch (command) {
    case 'all':
      console.log('Generating reports for all clients...');
      const reports = generateAllWeeklyReports();
      console.log(`Generated ${reports.length} report(s):`);
      for (const report of reports) {
        console.log(`  - ${report}`);
      }
      break;

    case 'client':
      const clientName = args[1];
      if (!clientName) {
        console.error('Error: Client name is required');
        console.log('Usage: npx tsx src/scripts/generate-reports.ts client "Client Name"');
        process.exit(1);
      }
      console.log(`Generating report for client: ${clientName}...`);
      const reportPath = generateWeeklyReport(clientName);
      console.log(`Report generated: ${reportPath}`);
      break;

    case 'list':
      console.log('Generated reports:\n');
      const allReports = listReports();
      if (allReports.length === 0) {
        console.log('No reports found.');
      } else {
        let currentWeek = '';
        for (const report of allReports) {
          if (report.week !== currentWeek) {
            currentWeek = report.week;
            console.log(`\n${report.week}:`);
          }
          console.log(`  - ${report.client}: ${report.path}`);
        }
      }
      break;

    case 'help':
    default:
      showHelp();
      break;
  }
}

main().catch(console.error);
