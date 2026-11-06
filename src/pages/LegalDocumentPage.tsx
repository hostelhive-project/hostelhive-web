import { Link, useParams } from 'react-router-dom';
import { legalDocuments, type LegalDocumentKind } from '../content/legalDocuments';

export default function LegalDocumentPage() {
  const { kind } = useParams();
  const document = kind && kind in legalDocuments ? legalDocuments[kind as LegalDocumentKind] : null;
  return <main className="mx-auto max-w-3xl px-5 py-10 space-y-6"><Link to="/register" className="auth-link">Back to registration</Link>{!document ? <h1>Document not found</h1> : <><header><h1 className="text-2xl font-bold">{document.title}</h1><p className="mt-2 text-sm text-slate-600">Updated {document.updated}</p></header>{document.sections.map((section) => <section key={section.heading} className="space-y-2"><h2 className="text-lg font-semibold">{section.heading}</h2><p className="text-sm leading-relaxed text-slate-700">{section.body}</p></section>)}</>}</main>;
}
