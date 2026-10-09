/** One DOM tree for screen pages and native browser PDF output. */
export default function PrintableDocument({ pages, visible, widthMm, heightMm, showPageNumbers }: {
  pages: string[]; visible: boolean; widthMm: number; heightMm: number; showPageNumbers: boolean;
}) {
  return <div className={`paper-paged-preview paper-paged-print-source${visible ? ' paper-paged-preview--visible' : ''}`} aria-label="Print layout preview">
    {pages.map((html, index) => <div className="paper-paged-preview-sheet" key={index}
      style={{ width: `${widthMm}mm`, height: `${heightMm}mm` }}>
      <div className="paper-paged-preview-slice" dangerouslySetInnerHTML={{ __html: html }} />
      {showPageNumbers && <div className="paper-shared-page-number">{index + 1}</div>}
    </div>)}
  </div>;
}
