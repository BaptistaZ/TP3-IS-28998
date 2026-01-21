import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function validateXmlWithXsd(xmlText, xsdPath) {
  
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "xmlsvc-"));
  const xmlFile = path.join(dir, "doc.xml");

  await fs.writeFile(xmlFile, xmlText, "utf8");

  try {
    // xmllint --noout --schema <xsd> <xml>
    await execFileAsync("xmllint", ["--noout", "--schema", xsdPath, xmlFile], {
      timeout: 15000,
    });
    return { ok: true };
  } catch (e) {
    // xmllint escreve mensagens em stderr
    const msg = e?.stderr?.toString?.() || e?.message || "XSD validation failed";
    return { ok: false, error: msg.trim() };
  } finally {
    // best-effort cleanup
    try { await fs.rm(dir, { recursive: true, force: true }); } catch {}
  }
}