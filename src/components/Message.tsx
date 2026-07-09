export function Message({
  error,
  success
}: {
  error?: string | string[];
  success?: string | string[];
}) {
  const errorText = Array.isArray(error) ? error[0] : error;
  const successText = Array.isArray(success) ? success[0] : success;

  if (errorText) return <div className="error">{decodeURIComponent(errorText)}</div>;
  if (successText) return <div className="success">{decodeURIComponent(successText)}</div>;
  return null;
}
