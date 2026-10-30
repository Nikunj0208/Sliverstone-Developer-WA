import { initDatabase } from "../src/db/index.js";

interface BatchDef {
  batchNumber: number;
  dateStr: string;
}

const KNOWN_BATCH_SCHEDULE: BatchDef[] = [
  { batchNumber: 1, dateStr: "2026-10-03" },
  { batchNumber: 2, dateStr: "2026-10-04" },
  { batchNumber: 3, dateStr: "2026-10-05" },
  { batchNumber: 4, dateStr: "2026-10-06" },
  { batchNumber: 5, dateStr: "2026-10-08" },
  { batchNumber: 6, dateStr: "2026-10-09" },
  { batchNumber: 7, dateStr: "2026-10-10" },
  { batchNumber: 8, dateStr: "2026-10-11" },
  { batchNumber: 9, dateStr: "2026-10-12" },
  { batchNumber: 10, dateStr: "2026-10-13" },
  { batchNumber: 11, dateStr: "2026-10-14" },
  { batchNumber: 12, dateStr: "2026-10-15" },
  { batchNumber: 13, dateStr: "2026-10-16" },
  { batchNumber: 14, dateStr: "2026-10-17" },
  { batchNumber: 15, dateStr: "2026-10-18" },
  { batchNumber: 16, dateStr: "2026-10-19" },
  { batchNumber: 17, dateStr: "2026-10-20" },
  { batchNumber: 18, dateStr: "2026-10-21" },
  { batchNumber: 19, dateStr: "2026-10-22" },
  { batchNumber: 20, dateStr: "2026-10-23" },
  { batchNumber: 21, dateStr: "2026-10-24" },
  { batchNumber: 22, dateStr: "2026-10-25" },
  { batchNumber: 23, dateStr: "2026-10-26" },
  { batchNumber: 24, dateStr: "2026-10-27" },
  { batchNumber: 25, dateStr: "2026-10-28" },
  { batchNumber: 26, dateStr: "2026-10-29" },
  { batchNumber: 27, dateStr: "2026-10-30" },
  { batchNumber: 28, dateStr: "2026-10-31" },
  { batchNumber: 29, dateStr: "2026-11-01" },
  { batchNumber: 30, dateStr: "2026-11-02" },
  { batchNumber: 31, dateStr: "2026-11-03" },
  { batchNumber: 32, dateStr: "2026-11-04" },
];

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d < 10 ? "0" + d : d} ${months[m - 1]} ${y}`;
}

async function main() {
  const repo = await initDatabase();
  const pool = (repo as any).pool;

  // 1. Meta template analytics
  const metaRes = await pool.query(`
    SELECT * FROM meta_template_analytics ORDER BY date_str ASC
  `);
  const metaMap = new Map<string, any>();
  for (const row of metaRes.rows) {
    metaMap.set(row.date_str, row);
  }

  // 2. Contacts count by date
  const contactRes = await pool.query(`
    SELECT 
      (first_seen_at AT TIME ZONE 'Asia/Kolkata')::date as b_date,
      COUNT(*) as count
    FROM contacts
    GROUP BY b_date
  `);
  const contactMap = new Map<string, number>();
  for (const row of contactRes.rows) {
    const ds = row.b_date.toISOString().slice(0, 10);
    contactMap.set(ds, Number(row.count));
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  console.log(`Today is: ${todayStr}`);

  const batches = [];
  for (const kb of KNOWN_BATCH_SCHEDULE) {
    const m = metaMap.get(kb.dateStr);
    const leadCount = contactMap.get(kb.dateStr) || (m ? Number(m.sent_count) : 200);
    const isCompleted = contactMap.has(kb.dateStr) || !!m;
    const isToday = kb.dateStr === todayStr;

    batches.push({
      batchNumber: kb.batchNumber,
      batchName: `Batch ${kb.batchNumber}`,
      dateStr: kb.dateStr,
      formattedDate: formatDate(kb.dateStr),
      count: leadCount,
      status: isToday ? "TODAY" : isCompleted ? "COMPLETED" : "SCHEDULED",
      sent: m ? Number(m.sent_count) : (isCompleted ? leadCount : 0),
      delivered: m ? Number(m.delivered_count) : 0,
      read: m ? Number(m.read_count) : 0,
      replied: m ? Number(m.replied_count) : 0,
      buttonClicks: m ? Number(m.button_clicks) : 0,
      amountSpent: m ? Number(m.amount_spent) : 0
    });
  }

  console.log(`Generated ${batches.length} batches. Sample:`);
  console.log(batches.slice(22, 28));

  process.exit(0);
}

main().catch(console.error);
