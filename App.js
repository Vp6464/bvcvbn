import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dateKey, emptyDay, numberValue, parseDate, sum, summarize } from './src/domain';

const STORAGE = '@cpma/data/v1';
const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const today = dateKey(new Date());
const definitions = {
  ganhos: { title: 'Ganhos do dia', action: 'ganho', options: ['Uber', '99', 'Outro'] },
  despesas: { title: 'Despesas do dia', action: 'despesa' },
  fixed: { title: 'Despesas fixas', action: 'despesa fixa', options: ['semanal', 'mensal', 'anual'] },
  extra: { title: 'Despesas pontuais', action: 'despesa pontual', options: ['mensal', 'anual'] },
};
function Button({ title, onPress, secondary, danger }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, danger && styles.danger, pressed && { opacity: 0.65 }]}><Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text></Pressable>;
}
function Field({ label, value, onChangeText, numeric, placeholder }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} value={value} onChangeText={onChangeText} keyboardType={numeric ? 'decimal-pad' : 'default'} placeholder={placeholder} placeholderTextColor="#748397" autoCapitalize="none" /></View>;
}
function Choices({ values, value, onChange }) {
  return <View style={styles.choices}>{values.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: option === value }} onPress={() => onChange(option)} style={[styles.choice, value === option && styles.selected]}><Text style={value === option ? styles.buttonText : styles.secondaryText}>{({ diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal', anual: 'Anual' })[option] || option}</Text></Pressable>)}</View>;
}
function EntrySection({ type, items, onSave, onDelete }) {
  const config = definitions[type];
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [option, setOption] = useState(config.options?.[0]);
  const [editing, setEditing] = useState(null);
  function reset() { setValue(''); setDescription(''); setEditing(null); setOption(config.options?.[0]); }
  function submit() {
    const amount = numberValue(value);
    if (!Number.isFinite(amount) || amount <= 0 || (type !== 'ganhos' && !description.trim())) {
      Alert.alert('Confira os campos', 'Informe um valor maior que zero e preencha a descrição quando aplicável.');
      return;
    }
    const item = { valor: amount, ...(type === 'ganhos' ? { app: option } : { desc: description.trim() }), ...(type === 'fixed' ? { freq: option } : {}), ...(type === 'extra' ? { tipo: option } : {}) };
    onSave(item, editing);
    reset();
  }
  return <View style={styles.card}>
    <View style={styles.sectionHeading}><View style={[styles.sectionIcon, type === 'ganhos' && styles.incomeIcon]}><Text style={styles.sectionSymbol}>{type === 'ganhos' ? '↗' : type === 'fixed' ? '↻' : type === 'extra' ? '◇' : '↘'}</Text></View><View style={styles.flex}><Text style={styles.sectionTitle}>{config.title}</Text><Text style={styles.note}>{items.length} {items.length === 1 ? 'lançamento' : 'lançamentos'}</Text></View></View>
    {items.length === 0 && <View style={styles.empty}><Text style={styles.emptyTitle}>Tudo pronto para começar</Text><Text style={styles.muted}>Adicione seu primeiro registro abaixo.</Text></View>}
    {items.map((item, index) => <View key={index} style={styles.entry}>
      <Text style={styles.entryTitle}>{item.app || item.desc}</Text><Text style={styles.amount}>{money(item.valor)}{item.freq || item.tipo ? ` · ${item.freq || item.tipo}` : ''}</Text>
      <View style={styles.choices}><Button title="Editar" secondary onPress={() => { setEditing(index); setValue(String(item.valor)); setDescription(item.desc || ''); setOption(item.app || item.freq || item.tipo); }} /><Button title="Excluir" danger onPress={() => { onDelete(index); reset(); }} /></View>
    </View>)}
    <Text style={styles.total}>Total: {money(sum(items))}</Text>
    <Field label="Valor (R$)" value={value} onChangeText={setValue} numeric placeholder="0,00" />
    {type !== 'ganhos' && <Field label="Descrição" value={description} onChangeText={setDescription} placeholder="Ex.: combustível, seguro…" />}
    {config.options && <><Text style={styles.label}>{type === 'ganhos' ? 'Aplicativo' : 'Frequência'}</Text><Choices values={config.options} value={option} onChange={setOption} /></>}
    <Button title={editing === null ? `Adicionar ${config.action}` : 'Salvar alterações'} onPress={submit} />
    {editing !== null && <Button title="Cancelar edição" secondary onPress={reset} />}
  </View>;
}
function Main() {
  const [data, setData] = useState({ days: {}, fixed: [], extra: [] });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [date, setDate] = useState(today);
  const [dateInput, setDateInput] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [period, setPeriod] = useState('diario');
  const [tab, setTab] = useState('dia');
  const queue = useRef(Promise.resolve());
  const day = data.days[date] || emptyDay();
  async function load() {
    setLoadError(false);
    try {
      const stored = await AsyncStorage.getItem(STORAGE);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed.days || !Array.isArray(parsed.fixed) || !Array.isArray(parsed.extra)) throw new Error('Dados inválidos');
        setData(parsed);
      }
      setReady(true);
    } catch { setLoadError(true); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!ready) return;
    const snapshot = JSON.stringify(data);
    queue.current = queue.current.catch(() => {}).then(() => AsyncStorage.setItem(STORAGE, snapshot)).then(() => setSaveError(false)).catch(() => setSaveError(true));
  }, [data, ready]);
  function changeDay(patch) {
    setData(previous => ({ ...previous, days: { ...previous.days, [date]: { ...(previous.days[date] || emptyDay()), ...patch } } }));
  }
  function changeItems(type, transform) {
    setData(previous => {
      if (type === 'fixed' || type === 'extra') return { ...previous, [type]: transform(previous[type]) };
      const current = previous.days[date] || emptyDay();
      return { ...previous, days: { ...previous.days, [date]: { ...current, [type]: transform(current[type]) } } };
    });
  }
  const validMonth = !!parseDate(`${month}-01`);
  const summary = summarize(data, date, period, validMonth ? month : date.slice(0, 7));
  if (!ready) return <View style={styles.loading}>{loadError ? <><Text>Não foi possível carregar os dados salvos.</Text><Button title="Tentar novamente" onPress={load} /></> : <ActivityIndicator size="large" color="#007acc" />}</View>;
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" /><KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
    <View style={styles.header}><View style={styles.logo}><Text style={styles.logoText}>C</Text></View><View style={styles.flex}><Text style={styles.brand}>CPMA<Text style={styles.brandDot}>.</Text></Text><Text style={styles.subtitle}>CONTROLE MOTORISTA</Text></View><View style={styles.badge}><View style={styles.dot} /><Text style={styles.badgeText}>Meu painel</Text></View></View>
    <View style={styles.welcome}><Text style={styles.eyebrow}>SUA ROTINA, NO CONTROLE</Text><Text style={styles.pageTitle}>Cada corrida conta.</Text><Text style={styles.muted}>Organize o dia. Acompanhe suas conquistas.</Text></View>
    <View style={styles.balanceCard}><View style={styles.sectionHeading}><Text style={styles.balanceLabel}>Saldo do dia</Text><Text style={styles.dateBadge}>{date.split('-').reverse().join('/')}</Text></View><Text adjustsFontSizeToFit numberOfLines={1} style={styles.balanceValue}>{money(sum(day.ganhos) - sum(day.despesas))}</Text><Text style={styles.balanceHint}>Ganhos menos despesas do dia</Text><View style={styles.balanceDivider} /><View style={styles.stats}><View style={styles.flex}><Text style={styles.balanceHint}>↗  Entradas</Text><Text style={styles.incomeValue}>{money(sum(day.ganhos))}</Text></View><View style={styles.flex}><Text style={styles.balanceHint}>↘  Saídas</Text><Text style={styles.expenseValue}>{money(sum(day.despesas))}</Text></View></View></View>
    <View style={styles.stats}><View style={styles.metricCard}><Text style={styles.metricLabel}>TEMPO NA RUA</Text><Text style={styles.metricValue}>{day.horas.toLocaleString('pt-BR')} <Text style={styles.metricUnit}>h</Text></Text></View><View style={styles.metricCard}><Text style={styles.metricLabel}>DISTÂNCIA</Text><Text style={styles.metricValue}>{day.km.toLocaleString('pt-BR')} <Text style={styles.metricUnit}>km</Text></Text></View></View>
    <View style={styles.tabs}>{[{ key: 'dia', label: 'Meu dia' }, { key: 'custos', label: 'Custos' }, { key: 'resumos', label: 'Resumos' }].map(item => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === item.key }} key={item.key} onPress={() => setTab(item.key)} style={[styles.tab, tab === item.key && styles.activeTab]}><Text style={[styles.tabText, tab === item.key && styles.activeTabText]}>{item.label}</Text></Pressable>)}</View>
    <Text style={saveError ? styles.error : styles.saveStatus}>{saveError ? 'Falha ao salvar. Toque abaixo para tentar novamente.' : '●  Salvamento automático ativado'}</Text>
    {saveError && <Button title="Tentar salvar novamente" onPress={() => setData(previous => ({ ...previous }))} />}
    <View style={[styles.card, tab !== 'dia' && styles.hidden]}><Text style={styles.sectionTitle}>Sua jornada</Text><Text style={styles.muted}>Escolha o dia e registre seu ritmo.</Text>
      <Field label="Data (AAAA-MM-DD)" value={dateInput} onChangeText={setDateInput} placeholder="2026-11-10" />
      <Button title="Carregar data" secondary onPress={() => { if (!parseDate(dateInput)) return Alert.alert('Data inválida', 'Use AAAA-MM-DD e informe uma data existente.'); setDate(dateInput); }} />
      <Text style={styles.total}>Dia em edição: {date.split('-').reverse().join('/')}</Text>
      <DailyFields key={date} day={day} onChange={changeDay} />
    </View>
    {Object.keys(definitions).map(type => <View key={type} style={(type === 'fixed' || type === 'extra' ? tab !== 'custos' : tab !== 'dia') && styles.hidden}><EntrySection key={`${type}-${date}`} type={type} items={type === 'fixed' || type === 'extra' ? data[type] : day[type]} onSave={(item, index) => changeItems(type, items => index === null ? [...items, item] : items.map((old, i) => i === index ? item : old))} onDelete={index => changeItems(type, items => items.filter((_, i) => i !== index))} /></View>)}
    <View style={[styles.card, tab !== 'resumos' && styles.hidden]}><Text style={styles.sectionTitle}>Seu desempenho</Text><Text style={styles.muted}>Uma visão clara de cada período.</Text><Choices values={['diario', 'semanal', 'mensal']} value={period} onChange={setPeriod} />
      {period === 'mensal' && <Field label="Mês (AAAA-MM)" value={month} onChangeText={setMonth} placeholder="2026-11" />}
      {period === 'mensal' && !validMonth ? <Text style={styles.error}>Informe um mês válido no formato AAAA-MM.</Text> : <>
        <Text style={styles.muted}>{summary.rows[0].date.split('-').reverse().join('/')} a {summary.rows.at(-1).date.split('-').reverse().join('/')}</Text>
        <Text style={styles.total}>Ganhos: {money(summary.ganhos)}</Text><Text style={styles.total}>Despesas: {money(summary.despesas)}</Text><Text style={styles.net}>Receita líquida: {money(summary.liquida)}</Text>
        <Text style={styles.muted}>{summary.horas.toLocaleString('pt-BR')} horas · {summary.km.toLocaleString('pt-BR')} km</Text>
        {period !== 'diario' && <><Text style={styles.note}>Rateio de fixas e pontuais: {money(summary.recurring)}. Valores por dia abaixo incluem somente despesas do dia.</Text><ScrollView horizontal><View><View style={styles.tableRow}>{['Data', 'Ganhos', 'Despesas', 'Receita'].map(label => <Text key={label} style={[styles.cell, styles.label]}>{label}</Text>)}</View>{summary.rows.map(row => <View key={row.date} style={[styles.tableRow, { backgroundColor: row.ganhos > 0 ? '#e3f5e9' : '#fff0ee' }]}>{[row.date.split('-').reverse().join('/'), money(row.ganhos), money(row.despesas), money(row.ganhos - row.despesas)].map((value, i) => <Text key={i} style={styles.cell}>{value}</Text>)}</View>)}</View></ScrollView></>}
      </>}
    </View>
    <Text style={styles.footer}>CPMA · Mais clareza para ir mais longe.</Text>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
function DailyFields({ day, onChange }) {
  const [hours, setHours] = useState(String(day.horas || ''));
  const [km, setKm] = useState(String(day.km || ''));
  function update(text, setter, key) {
    setter(text);
    const value = text.trim() === '' ? 0 : numberValue(text);
    if (Number.isFinite(value)) onChange({ [key]: value });
  }
  return <><Field label="Horas trabalhadas" value={hours} numeric onChangeText={text => update(text, setHours, 'horas')} placeholder="0" /><Field label="Quilômetros rodados" value={km} numeric onChangeText={text => update(text, setKm, 'km')} placeholder="0" />{[hours, km].some(value => value !== '' && !Number.isFinite(numberValue(value))) && <Text style={styles.error}>Use números positivos; separe decimais com vírgula ou ponto.</Text>}</>;
}
export default function App() { return <SafeAreaProvider><Main /></SafeAreaProvider>; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f6f8' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  flex: { flex: 1 }, hidden: { display: 'none' }, container: { padding: 20, paddingBottom: 40, width: '100%', maxWidth: 760, alignSelf: 'center', gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }, logo: { width: 44, height: 44, backgroundColor: '#123d36', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, logoText: { color: '#b8f480', fontSize: 28, fontWeight: '900' },
  brand: { fontSize: 24, fontWeight: '900', color: '#183c36', letterSpacing: -1 }, brandDot: { color: '#36a781' }, subtitle: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: '#788883' }, badge: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, backgroundColor: '#e7eeeb', borderRadius: 20 }, badgeText: { fontSize: 11, fontWeight: '600', color: '#315b4f' }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#28886c' },
  welcome: { gap: 6, paddingVertical: 8 }, eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#648176' }, pageTitle: { fontSize: 30, fontWeight: '800', color: '#193c35', letterSpacing: -1 },
  balanceCard: { backgroundColor: '#153f36', borderRadius: 24, padding: 24, gap: 10, overflow: 'hidden' }, balanceLabel: { color: '#d5e6dd', fontSize: 14, fontWeight: '600', flex: 1 }, dateBadge: { color: '#e1f2e9', backgroundColor: '#2a5146', borderRadius: 8, padding: 8, fontSize: 11 }, balanceValue: { color: '#d2ffa4', fontSize: 42, fontWeight: '700', letterSpacing: -1.5, fontVariant: ['tabular-nums'] }, balanceHint: { color: '#b0cbbf', fontSize: 12 }, balanceDivider: { height: 1, backgroundColor: '#365a4e', marginVertical: 8 }, stats: { flexDirection: 'row', gap: 12 }, incomeValue: { color: '#d2ffa4', fontSize: 18, fontWeight: '700', marginTop: 6 }, expenseValue: { color: '#ffcec0', fontSize: 18, fontWeight: '700', marginTop: 6 },
  metricCard: { flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 10, borderWidth: 1, borderColor: '#e7ece9' }, metricLabel: { color: '#73857c', fontSize: 10, fontWeight: '700', letterSpacing: 1 }, metricValue: { fontSize: 26, fontWeight: '700', color: '#193c35' }, metricUnit: { fontSize: 14, fontWeight: '500', color: '#73857c' },
  tabs: { flexDirection: 'row', backgroundColor: '#e6ebe8', padding: 5, borderRadius: 15, gap: 4 }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 11 }, activeTab: { backgroundColor: '#fff', shadowColor: '#123d36', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, tabText: { color: '#65796e', fontWeight: '600', fontSize: 13 }, activeTabText: { color: '#153f36' }, saveStatus: { color: '#547567', fontSize: 11, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 22, gap: 16, borderWidth: 1, borderColor: '#e7ece9' }, sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, sectionTitle: { fontSize: 19, fontWeight: '700', color: '#193c35', letterSpacing: -0.4 }, sectionIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#fff1e9', alignItems: 'center', justifyContent: 'center' }, incomeIcon: { backgroundColor: '#eaf5e3' }, sectionSymbol: { color: '#315a45', fontSize: 25 }, empty: { padding: 20, backgroundColor: '#f7f9f6', borderWidth: 1, borderColor: '#e8eee5', borderStyle: 'dashed', borderRadius: 14, alignItems: 'center', gap: 5 }, emptyTitle: { color: '#47634f', fontWeight: '600', fontSize: 13 },
  field: { gap: 8 }, label: { fontWeight: '600', fontSize: 12, color: '#52685c' }, input: { borderWidth: 1, borderColor: '#e0e7e2', borderRadius: 12, padding: 14, minHeight: 50, fontSize: 16, color: '#193c35', backgroundColor: '#f8faf8' },
  button: { backgroundColor: '#1b5746', borderRadius: 12, minHeight: 48, padding: 14, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#fff', fontWeight: '600', fontSize: 13 }, secondary: { backgroundColor: '#edf3ee' }, secondaryText: { color: '#345d48', fontWeight: '600', fontSize: 13 }, danger: { backgroundColor: '#b74b42' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { paddingVertical: 12, paddingHorizontal: 18, minHeight: 44, backgroundColor: '#f0f4ef', borderRadius: 11 }, selected: { backgroundColor: '#1b5746' },
  entry: { borderBottomWidth: 1, borderColor: '#e7ece9', paddingVertical: 12, gap: 10 }, entryTitle: { fontSize: 16, fontWeight: '600', color: '#193c35' }, amount: { color: '#52685c', fontSize: 16 }, total: { fontWeight: '700', color: '#345b46', fontSize: 15 }, net: { fontWeight: '800', color: '#1b5746', fontSize: 22 },
  muted: { color: '#718277', fontSize: 13, lineHeight: 21 }, note: { color: '#718277', fontSize: 11, lineHeight: 18 }, error: { color: '#b12a2a' }, tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e1e9e2' }, cell: { width: 115, padding: 12, color: '#314f3e', fontSize: 12 }, footer: { color: '#819086', fontSize: 11, textAlign: 'center', paddingVertical: 8 },
});
