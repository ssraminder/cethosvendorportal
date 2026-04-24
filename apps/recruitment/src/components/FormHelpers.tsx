import { Upload } from 'lucide-react'
import type { UseFormReturn, FieldValues, Path } from 'react-hook-form'
import { FormSection } from './FormSection'

interface CvSectionProps {
  cvFile: File | null
  setCvFile: (f: File | null) => void
  handleCvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** Render a red missing-CV error under the drop zone. */
  showMissingError?: boolean
}

export function CvSection({ cvFile, setCvFile, handleCvUpload, showMissingError }: CvSectionProps) {
  return (
    <FormSection
      title="Resume / CV *"
      description="Upload your most recent CV as a PDF (max 10MB). Required. If you have a DOCX, please export to PDF first."
    >
      <div className="space-y-2">
        {!cvFile ? (
          <label
            className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
              showMissingError
                ? 'border-red-400 bg-red-50 hover:border-red-500'
                : 'border-gray-300 hover:border-cethos-teal'
            }`}
          >
            <Upload className={`w-5 h-5 ${showMissingError ? 'text-red-500' : 'text-gray-400'}`} />
            <span className={`text-sm ${showMissingError ? 'text-red-700 font-medium' : 'text-gray-500'}`}>
              Click to upload your CV (PDF only)
            </span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={handleCvUpload}
            />
          </label>
        ) : (
          <div className="flex items-center justify-between bg-cethos-bg-blue rounded-md px-3 py-2 border border-cethos-teal/30">
            <span className="text-sm text-cethos-navy truncate">{cvFile.name}</span>
            <button
              type="button"
              onClick={() => setCvFile(null)}
              className="text-gray-500 hover:text-red-600 text-sm"
            >
              Remove
            </button>
          </div>
        )}
        {showMissingError && !cvFile && (
          <p className="text-xs text-red-600">CV is required to submit your application.</p>
        )}
      </div>
    </FormSection>
  )
}

interface ConsentSectionProps<T extends FieldValues> {
  form: UseFormReturn<T>
}

export function ConsentSection<T extends FieldValues>({ form }: ConsentSectionProps<T>) {
  const errors = form.formState.errors as Record<string, { message?: string } | undefined>
  return (
    <FormSection title="Consent">
      <div className="space-y-3">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            {...form.register('privacyPolicy' as Path<T>)}
            className="mt-0.5 text-cethos-teal focus:ring-cethos-teal"
          />
          <span className="text-sm text-gray-700">
            I agree to the{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-cethos-teal hover:text-cethos-teal-light underline">
              Privacy Policy
            </a>{' '}
            <span className="text-red-500">*</span>
          </span>
        </label>
        {errors.privacyPolicy?.message && (
          <p className="text-sm text-red-600 ml-6">{errors.privacyPolicy.message}</p>
        )}

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            {...form.register('consentTest' as Path<T>)}
            className="mt-0.5 text-cethos-teal focus:ring-cethos-teal"
          />
          <span className="text-sm text-gray-700">
            I consent to receiving a skills test or assessment as part of this application <span className="text-red-500">*</span>
          </span>
        </label>
        {errors.consentTest?.message && (
          <p className="text-sm text-red-600 ml-6">{errors.consentTest.message}</p>
        )}

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            {...form.register('consentUnpaid' as Path<T>)}
            className="mt-0.5 text-cethos-teal focus:ring-cethos-teal"
          />
          <span className="text-sm text-gray-700">
            I understand the test is unpaid <span className="text-red-500">*</span>
          </span>
        </label>
        {errors.consentUnpaid?.message && (
          <p className="text-sm text-red-600 ml-6">{errors.consentUnpaid.message}</p>
        )}
      </div>
    </FormSection>
  )
}
