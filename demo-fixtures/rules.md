# Wallpad demonstration coding rules

These are synthetic coding rules for repeatable demonstrations, not quotations from the protected protocol attachment.

- Do not use `console.log` in application source. Use a structured logger.
- Do not use `eval` to interpret a received message. Parse and validate fields.
- A function must contain at most 20 lines.
- The line length must not exceed 100 characters.
- All function names must follow camelCase.

The log examples imitate the supplied logs' message envelope and copy-format errors. Apartment identifiers and operational records are not included.
