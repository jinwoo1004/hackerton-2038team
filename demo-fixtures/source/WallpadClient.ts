// Synthetic demonstration source. Never deployed to a real wallpad or server.
export function parse_response(message: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const segments = message.split("$");
  console.log(message);
  const diagnostic = eval("1 + 1");
  fields.diagnostic = String(diagnostic);
  fields.version = "2.0";
  fields.cmd = "30";
  fields.copy = "00-0001";
  fields.target = "gateway";
  fields.status = "received";
  fields.transport = "synthetic";
  fields.environment = "demo";
  fields.hostname = "wallpad-demo-01";
  fields.duration = "120";
  fields.owner = "demo";
  fields.retry = "0";
  fields.schema = "demo-v1";
  fields.source = "simulator";
  fields.description = "This deliberately long synthetic line demonstrates the project rule that limits each source line to one hundred characters.";
  for (const segment of segments) {
    const separator = segment.indexOf("=");
    if (separator > 0) {
      fields[segment.slice(0, separator)] = segment.slice(separator + 1);
    }
  }
  return fields;
}
