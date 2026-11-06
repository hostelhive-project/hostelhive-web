import { AlertCircle, CheckCircle2, Clock3, RefreshCw, ScanEye, Sparkles } from 'lucide-react';
import type { CleaningAssessment } from '../types/api';

const reasons: Record<string, string> = {
  disabled: 'AI assessment is turned off. Review the photos manually.',
  not_configured: 'Groq is not configured. Review the photos manually.',
  daily_limit: 'The daily AI request allowance has been reached. Review this task manually.',
  provider_limit: 'Groq’s usage limit was reached. Review the photos manually.',
  provider_error: 'The AI service could not provide a valid assessment. Review the photos manually.',
  attempt_limit: 'The assessment could not finish after two attempts. Review the photos manually.',
  queue_timeout: 'The assessment window expired. Review the photos manually.',
  missing_photos: 'Both before and after photos are needed for comparison.',
  duplicate_photos: 'The same photo was provided twice. A fair comparison needs two separate photos.',
  unsupported_photo: 'The photos must be registered cleaning uploads from the assigned staff account (JPG, PNG or WEBP, up to 5 MB each).',
  photo_unavailable: 'One or both photos could not be retrieved. Review the original uploads manually.',
  insufficient_evidence: 'The photos do not provide enough comparable evidence for a reliable score.',
  sensitive_content: 'The photos may contain faces or personal documents. Review them manually.',
  no_visible_cleaning_area: 'No cleaning area could be recognized in the photos. Upload photos showing the room or cleaned surface.',
};

function hasScore(assessment?: CleaningAssessment): assessment is CleaningAssessment & { score: number } {
  return assessment?.status === 'Assessed' && typeof assessment.score === 'number';
}

export function CleaningAssessmentBadge({ assessment }: { assessment?: CleaningAssessment }) {
  const scored = hasScore(assessment);
  const pending = assessment?.status === 'Pending' || assessment?.status === 'Processing';
  const label = scored ? `AI ${assessment.score}/10` : pending ? 'AI pending'
    : assessment?.status === 'ManualReview' ? 'Awaiting new rating' : assessment ? 'AI unavailable' : 'Not assessed';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold ${
      scored ? 'border-slate-200 bg-slate-50 text-[#0b1329]' : pending ? 'border-blue-100 bg-blue-50 text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-800'
    }`}>
      {pending ? <Clock3 size={12} aria-hidden="true" /> : scored ? <Sparkles size={12} aria-hidden="true" /> : <AlertCircle size={12} aria-hidden="true" />}
      {label}
    </span>
  );
}

export default function CleaningAssessmentPanel({ assessment, onRefresh, refreshing = false }: {
  assessment?: CleaningAssessment; onRefresh: () => void; refreshing?: boolean;
}) {
  const scored = hasScore(assessment);
  const pending = assessment?.status === 'Pending' || assessment?.status === 'Processing';
  const breakdown = assessment?.breakdown;
  const message = pending
    ? assessment?.reason === 'temporary_failure' ? 'The service was temporarily unavailable. One retry is queued.'
      : 'Comparing the before and after photos. Assessments run in the background and may queue to respect usage limits.'
    : assessment?.reason ? reasons[assessment.reason] || 'Review the photos manually.'
      : assessment ? 'Review the assessment alongside the original photos.' : 'No AI assessment was requested for this task.';
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label="AI cleaning assessment">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-4">
        <div className="flex items-center gap-2.5">
          <span className="rounded-xl bg-[#0b1329] p-2 text-white"><ScanEye size={18} aria-hidden="true" /></span>
          <div><h3 className="text-sm font-semibold text-[#0b1329]">AI cleaning assessment</h3><p className="text-xs text-slate-500">Visible cleanliness · Before &amp; after</p></div>
        </div>
        <button type="button" onClick={onRefresh} disabled={refreshing} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50" aria-label="Refresh cleaning assessment">
          <RefreshCw size={13} className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />{refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>
      <div className="space-y-4 p-4" aria-live="polite" aria-atomic="true">
        {scored ? (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-baseline justify-center rounded-2xl bg-[#0b1329] pt-5 text-white" aria-label={`Visible cleanliness score ${assessment.score} out of 10`}>
                <span className="text-3xl font-semibold">{assessment.score}</span><span className="ml-0.5 text-xs text-slate-300">/10</span>
              </div>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{assessment.estimated ? 'Estimated cleanliness rating' : 'After-cleaning appearance'}</p><p className="mt-1 text-xs leading-relaxed text-slate-600">{assessment.summary}</p><p className="mt-1.5 text-xs font-medium text-slate-500">Change from before: {assessment.comparison || 'Unclear'}</p>{assessment.estimated && typeof assessment.evidenceCoverage === 'number' && <p className="mt-1 text-xs text-slate-500">Visible rubric coverage: {assessment.evidenceCoverage}%{assessment.imageQuality !== 'Good' ? ' · Limited photo quality' : ''}</p>}</div>
            </div>
            {breakdown && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([['Visible litter', breakdown.waste, 3], ['Floor', breakdown.floor, 3], ['Surfaces', breakdown.surfaces, 3], ['Tidiness', breakdown.tidiness, 1]] as const).map(([label, value, max]) => (
                <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-900">{value === null ? <span className="text-xs font-normal text-slate-500">Not visible</span> : <>{value}<span className="font-normal text-slate-400">/{max}</span></>}</p></div>
              ))}
            </div>}
          </>
        ) : <div className="space-y-2"><CleaningAssessmentBadge assessment={assessment} /><p className="text-xs leading-relaxed text-slate-600">{message}</p>{assessment?.summary && <p className="text-xs leading-relaxed text-slate-600">{assessment.summary}</p>}</div>}
        {([
          ['Visible improvements', assessment?.improvements, CheckCircle2, 'text-emerald-700'],
          ['Needs attention', assessment?.issues, AlertCircle, 'text-amber-700'],
          ['Evidence limitations', assessment?.limitations, ScanEye, 'text-slate-500'],
        ] as const).map(([label, items, Icon, color]) => items && items.length > 0 && (
          <div key={label}><h4 className={`flex items-center gap-1.5 text-xs font-semibold ${color}`}><Icon size={14} aria-hidden="true" />{label}</h4><ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600">{items.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
        ))}
        <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">AI guidance only. Photos cannot verify hygiene or disinfection. The administrator makes the final decision using the original photos.</p>
        {assessment?.assessedAt && <p className="text-[11px] text-slate-400">Assessed {new Date(assessment.assessedAt).toLocaleString()} · Groq{assessment.model ? ` / ${assessment.model}` : ''}</p>}
      </div>
    </section>
  );
}
