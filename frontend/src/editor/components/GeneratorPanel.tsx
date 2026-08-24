import { useId, useState } from 'react'
import type { ChangeEvent as ReactChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { GenerationParams } from '@/generator'
import styles from './GeneratorPanel.module.css'

export interface GeneratorPanelProps {
  onGenerate: (params: GenerationParams) => void
}

interface FormState {
  genType: 'dungeon' | 'caves'
  seed: string
  width: string
  height: string
  roomAttempts: string
  fillProbability: string
  smoothingIterations: string
}

const DEFAULT_FORM: FormState = {
  genType: 'dungeon',
  seed: '42',
  width: '40',
  height: '30',
  roomAttempts: '150',
  fillProbability: '0.45',
  smoothingIterations: '4',
}

/** Целое или null — без исключений, валидность решает кнопка. */
function parseIntStrict(value: string): number | null {
  if (!/^-?\d+$/.test(value.trim())) return null
  return Number(value)
}

function parseFloatStrict(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Зеркалит контракты генераторов (минимальные размеры данжа/пещер,
 * диапазоны параметров), чтобы кнопка блокировалась до dispatch.
 * Авторитетная валидация остаётся в самих генераторах.
 */
export function parseForm(state: FormState): GenerationParams | null {
  const seed = parseIntStrict(state.seed)
  const width = parseIntStrict(state.width)
  const height = parseIntStrict(state.height)

  const dimsValid =
    width !== null && height !== null && width >= 6 && width <= 300 && height >= 6 && height <= 300
  if (seed === null || !dimsValid) return null

  if (state.genType === 'caves') {
    const fill = parseFloatStrict(state.fillProbability)
    const iterations = parseIntStrict(state.smoothingIterations)
    if (
      fill === null ||
      fill < 0 ||
      fill > 1 ||
      iterations === null ||
      iterations < 0 ||
      iterations > 20
    ) {
      return null
    }
    return {
      type: 'caves',
      seed,
      width,
      height,
      fillProbability: fill,
      smoothingIterations: iterations,
    }
  }

  const roomAttempts = parseIntStrict(state.roomAttempts)
  if (roomAttempts === null || roomAttempts < 1 || roomAttempts > 10000) return null

  return { type: 'dungeon', seed, width, height, roomAttempts }
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
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)

  function bindField(key: keyof FormState) {
    return (event: ReactChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }))
  }

  function fieldId(key: string): string {
    return `${uid}-${key}`
  }

  const params = parseForm(form)

  function generate() {
    if (params) onGenerate(params)
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

      <button type="button" className={styles.generate} disabled={!params} onClick={generate}>
        {t('editor.generator.generate')}
      </button>
    </section>
  )
}
