import { useId, useState } from 'react'
import type { ChangeEvent as ReactChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { GenerationParams } from '@/generator'
import { DEFAULT_GENERATOR_FORM, parseGeneratorForm } from './generatorForm'
import type { GeneratorFormState } from './generatorForm'
import styles from './GeneratorPanel.module.css'

export interface GeneratorPanelProps {
  onGenerate: (params: GenerationParams) => void
}

interface FieldProps {
  id: string
  label: string
  min?: number
  max?: number
  step?: number
  value: string
  onChange: (event: ReactChangeEvent<HTMLInputElement>) => void
}

function NumberField({ id, label, min, max, step, value, onChange }: FieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
      />
    </div>
  )
}

export function GeneratorPanel({ onGenerate }: GeneratorPanelProps) {
  const { t } = useTranslation()
  const uid = useId()
  const [form, setForm] = useState<GeneratorFormState>(DEFAULT_GENERATOR_FORM)
  // Последние успешные параметры для кнопки «Ещё раз» (тот же seed = та же карта).
  const [lastParams, setLastParams] = useState<GenerationParams | null>(null)

  function bindField(key: keyof GeneratorFormState) {
    return (event: ReactChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }))
  }

  function fieldId(key: string): string {
    return `${uid}-${key}`
  }

  const params = parseGeneratorForm(form)

  function generate() {
    if (params) {
      setLastParams(params)
      onGenerate(params)
    }
  }

  return (
    <section className={styles.panel} aria-label={t('editor.generator.title')}>
      <div className={styles.typeToggle} role="group" aria-label={t('editor.generator.type')}>
        {(['dungeon', 'caves'] as const).map((genType) => (
          <button
            key={genType}
            type="button"
            className={[styles.typeButton, form.genType === genType ? styles.selected : '']
              .filter(Boolean)
              .join(' ')}
            aria-pressed={form.genType === genType}
            onClick={() => setForm((current) => ({ ...current, genType }))}
          >
            {t(`editor.generator.${genType}`)}
          </button>
        ))}
      </div>

      <NumberField
        id={fieldId('seed')}
        label={t('editor.generator.seed')}
        value={form.seed}
        onChange={bindField('seed')}
      />

      <div className={styles.row}>
        <NumberField
          id={fieldId('width')}
          label={t('editor.generator.width')}
          min={6}
          max={300}
          value={form.width}
          onChange={bindField('width')}
        />
        <NumberField
          id={fieldId('height')}
          label={t('editor.generator.height')}
          min={6}
          max={300}
          value={form.height}
          onChange={bindField('height')}
        />
      </div>

      {form.genType === 'dungeon' ? (
        <NumberField
          id={fieldId('roomAttempts')}
          label={t('editor.generator.roomAttempts')}
          min={1}
          max={10000}
          value={form.roomAttempts}
          onChange={bindField('roomAttempts')}
        />
      ) : (
        <>
          <NumberField
            id={fieldId('fillProbability')}
            label={t('editor.generator.fillProbability')}
            min={0}
            max={1}
            step={0.05}
            value={form.fillProbability}
            onChange={bindField('fillProbability')}
          />
          <NumberField
            id={fieldId('smoothingIterations')}
            label={t('editor.generator.iterations')}
            min={0}
            max={20}
            value={form.smoothingIterations}
            onChange={bindField('smoothingIterations')}
          />
        </>
      )}

      <button
        type="button"
        className={styles.generate}
        disabled={!params}
        onClick={generate}
      >
        {t('editor.generator.generate')}
      </button>
      {lastParams !== null && (
        <button
          type="button"
          className={styles.again}
          onClick={() => onGenerate(lastParams)}
        >
          {t('editor.generator.again')}
        </button>
      )}
    </section>
  )
}
