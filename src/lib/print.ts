/**
 * Cross-platform print helper utility for Mobile & Desktop browsers
 */

export async function triggerPrint(
  wrapperId: string,
  fallbackPdfFn?: () => Promise<void>
) {
  try {
    const el = document.getElementById(wrapperId);
    
    // If element doesn't exist, use fallback PDF if available, or call window.print
    if (!el) {
      if (fallbackPdfFn) {
        await fallbackPdfFn();
        return;
      }
      window.print();
      return;
    }

    // Temporarily ensure the element is visible to mobile rendering engines before triggering print dialog
    const originalDisplay = el.style.display;
    el.style.display = "block";
    document.body.classList.add("is-printing");

    // Give mobile browsers (Blink/WebKit) time to paint the element into the layout engine
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Trigger window.print
    window.print();

    // Restore state after print dialog opens
    setTimeout(() => {
      if (el) el.style.display = originalDisplay;
      document.body.classList.remove("is-printing");
    }, 1000);
  } catch (error) {
    console.error("Print failed, attempting PDF export fallback:", error);
    if (fallbackPdfFn) {
      await fallbackPdfFn();
    }
  }
}
