export type SmsTemplateVariables = Record<
  string,
  string | number | null | undefined
>;

export function renderSmsTemplate(
  template: string,
  variables: SmsTemplateVariables,
) {
  return template.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (match, key: string) => {
      const value = variables[key];

      if (value === null || value === undefined) {
        return match;
      }

      return String(value);
    },
  );
}
