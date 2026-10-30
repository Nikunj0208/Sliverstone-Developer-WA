import axios from "axios";
import vm from "vm";

async function run() {
  const res = await axios.get("http://localhost:3000/contacts");
  const html = res.data;
  
  const regex = /<script>([\s\S]*?)<\/script>/gi;
  let match;
  let i = 1;
  while ((match = regex.exec(html)) !== null) {
    const code = match[1];
    console.log(`Checking script #${i}...`);
    try {
      new vm.Script(code);
      console.log(`Script #${i} OK`);
    } catch (e: any) {
      console.error(`Script #${i} Error:`, e.message);
      const lines = code.split("\n");
      const errLine = e.stack.match(/evalmachine\.<anonymous>:(\d+)/);
      if (errLine) {
        const lineNum = parseInt(errLine[1], 10);
        console.error("Around error:");
        for (let j = Math.max(0, lineNum - 5); j < Math.min(lines.length, lineNum + 5); j++) {
          console.error(`${j + 1}: ${lines[j]}`);
        }
      }
    }
    i++;
  }
}

run();

