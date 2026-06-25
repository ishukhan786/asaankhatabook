export function exportToCSV(data: any[], filename: string) {
  if (!data || !data.length) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          let value = row[header];
          if (value === null || value === undefined) value = "";
          // Escape quotes and wrap in quotes if there's a comma
          if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
            value = `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
