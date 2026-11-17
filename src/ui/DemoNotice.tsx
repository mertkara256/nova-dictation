/** İnternetteki deneme sürümünde (npm run build:demo) en üstte durur; asıl sürümden farkını anlatır. */
export function DemoNotice() {
  return (
    <p className="demo-notice">
      <strong>Deneme sürümü.</strong> Burada konuşmayı tarayıcının kendi tanıması yazıya çeviriyor ve ses
      Google'a ya da Apple'a gidiyor. Bu tanıma noktalama koymadığı için her duraklamada cümle bitmiş
      sayılır. Sesin bilgisayardan çıkmadığı, noktalamalı ve tuşla komut verilebilen sürüm için{' '}
      <a href="https://github.com/mertkara256/nova-dictation#hızlı-başlangıç" target="_blank" rel="noreferrer">
        uygulamayı bilgisayarına kur
      </a>
      .
    </p>
  )
}
