import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { compressAndUploadImage } from './imageUtils';
import { 
  Settings, Tag, Package, Calculator, PlusCircle, Edit3, 
  ShoppingCart, BarChart2, Lock, Unlock, Camera, Upload, 
  AlertCircle, CheckCircle2, ChevronRight, Sparkles, Search, 
  X, Info, Clock, Weight, Maximize2, Check 
} from 'lucide-react';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [activeTab, setActiveTab] = useState('cotizar');

  // Estados Base
  const [config, setConfig] = useState(null);
  const [materiales, setMateriales] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [piezas, setPiezas] = useState([]);

  // Buscador y Cotizador
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPiezaModal, setSelectedPiezaModal] = useState(null);
  const [simNivelServicio, setSimNivelServicio] = useState(2);
  const [simMargenGanancia, setSimMargenGanancia] = useState(50);
  const [savingEstimativo, setSavingEstimativo] = useState(false);

  // Formulario Añadir / Editar
  const [piezasForm, setPiezasForm] = useState({
    id: null,
    titulo: '',
    categoria_id: '',
    material_id: '',
    peso_gramos: '',
    horas: '',
    minutos: '',
    ancho_cm: '',
    alto_cm: '',
    profundidad_cm: '',
    imagen_principal_url: '',
    es_multicolor: false
  });

  const [codigoGenerado, setCodigoGenerado] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formErrors, setFormErrors] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');

  // Estados Admin
  const [nuevoMaterial, setNuevoMaterial] = useState({ nombre: '', precio_kg: '' });
  const [nuevaCategoria, setNuevaCategoria] = useState({ nombre: '', prefijo: '' });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    const { data: cfg } = await supabase.from('config_global').select('*').single();
    if (cfg) setConfig(cfg);

    const { data: mat } = await supabase.from('materiales').select('*').order('nombre');
    if (mat) {
      setMateriales(mat);
      if (mat.length > 0 && !piezasForm.material_id) {
        setPiezasForm(prev => ({ ...prev, material_id: mat[0].id }));
      }
    }

    const { data: cat } = await supabase.from('categorias').select('*').order('nombre');
    if (cat) {
      setCategorias(cat);
      if (cat.length > 0 && !piezasForm.categoria_id) {
        setPiezasForm(prev => ({ ...prev, categoria_id: cat[0].id }));
        obtenerCodigoCategoria(cat[0].id);
      }
    }

    const { data: pza } = await supabase.from('piezas').select('*, categorias(*), materiales(*)').order('created_at', { ascending: false });
    if (pza) setPiezas(pza);
  };

  const obtenerCodigoCategoria = async (catId) => {
    if (!catId) return;
    const { data, error } = await supabase.rpc('obtener_siguiente_codigo', { p_categoria_id: catId });
    if (!error && data && data.length > 0) {
      setCodigoGenerado(data[0].nuevo_codigo);
    }
  };

  // FÓRMULA DE CÁLCULO DE COSTO Y PRECIO FINAL (EXCEL)
  const calcularCostosPieza = (pieza, nivelServicio = 2, margenGanancia = 50) => {
    if (!pieza || !config) return { costoTotal: 0, precioFinal: 0, subtotal: 0 };

    const material = pieza.materiales || materiales.find(m => m.id === pieza.material_id);
    const precioKg = material ? parseFloat(material.precio_kg) : 0;
    
    // 1. Costo de Material
    const costoMaterial = (parseFloat(pieza.peso_gramos) / 1000) * precioKg;

    // 2. Tiempo total en horas
    const tiempoHoras = parseFloat(pieza.horas) + (parseFloat(pieza.minutos) / 60);

    // 3. Costo de Energía
    const costoEnergia = tiempoHoras * parseFloat(config.consumo_impresora_kw) * parseFloat(config.precio_energia_kwh);

    // 4. Amortización
    const costoAmortizacion = config.vida_util_horas > 0 
      ? (parseFloat(config.precio_impresora) / parseFloat(config.vida_util_horas)) * tiempoHoras 
      : 0;

    // 5. Costo de Servicio (Servicio 1 = base, Servicio 2 = 2x, etc.)
    const costoServicio = tiempoHoras * parseFloat(config.costo_servicio_hora) * parseFloat(nivelServicio);

    // Subtotal
    const subtotal = costoMaterial + costoEnergia + costoAmortizacion + costoServicio;

    // Precio Final con Margen
    const precioFinal = subtotal * (1 + parseFloat(margenGanancia) / 100);

    return {
      costoMaterial,
      costoEnergia,
      costoAmortizacion,
      costoServicio,
      subtotal,
      precioFinal: Math.round(precioFinal)
    };
  };

  const abrirModalCotizar = (p) => {
    setSelectedPiezaModal(p);
    setSimNivelServicio(p.nivel_servicio_estimativo || 2);
    setSimMargenGanancia(p.margen_ganancia_estimativo || 50);
  };

  const guardarValorEstimativo = async () => {
    if (!selectedPiezaModal) return;
    try {
      setSavingEstimativo(true);
      const { error } = await supabase
        .from('piezas')
        .update({
          nivel_servicio_estimativo: parseInt(simNivelServicio, 10),
          margen_ganancia_estimativo: parseFloat(simMargenGanancia)
        })
        .eq('id', selectedPiezaModal.id);

      if (!error) {
        setSuccessMsg('¡Nuevo precio estimativo fijado!');
        cargarDatos();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } finally {
      setSavingEstimativo(false);
    }
  };

  // FILTRADO DE PIEZAS EN LA GRILLA
  const piezasFiltradas = piezas.filter(p => {
    const term = searchTerm.toLowerCase();
    const tituloMatch = p.titulo.toLowerCase().includes(term);
    const codigoMatch = p.codigo.toLowerCase().includes(term);
    const catMatch = p.categorias?.nombre?.toLowerCase().includes(term);
    return tituloMatch || codigoMatch || catMatch;
  });

  const handleCategoriaChange = (catId) => {
    setPiezasForm({ ...piezasForm, categoria_id: catId });
    if (!piezasForm.id) obtenerCodigoCategoria(catId);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const url = await compressAndUploadImage(file, 'piezas');
      setPiezasForm(prev => ({ ...prev, imagen_principal_url: url }));
    } catch (err) {
      alert('Error al subir imagen compressed');
    } finally {
      setUploadingImage(false);
    }
  };

  const validarFormulario = () => {
    const errores = [];
    if (!piezasForm.titulo.trim()) errores.push('Título de la pieza');
    if (!piezasForm.peso_gramos || parseFloat(piezasForm.peso_gramos) <= 0) errores.push('Peso en gramos');
    if (piezasForm.horas === '' || parseInt(piezasForm.horas) < 0) errores.push('Horas de impresión');
    if (piezasForm.minutos === '' || parseInt(piezasForm.minutos) < 0) errores.push('Minutos de impresión');

    setFormErrors(errores);
    return errores.length === 0;
  };

  const guardarPieza = async (e) => {
    e.preventDefault();
    if (!validarFormulario()) return;

    let numCorrelativo = 1;
    if (codigoGenerado) {
      const parts = codigoGenerado.split('-');
      if (parts.length === 2) numCorrelativo = parseInt(parts[1], 10);
    }

    const payload = {
      titulo: piezasForm.titulo,
      categoria_id: piezasForm.categoria_id,
      material_id: piezasForm.material_id,
      peso_gramos: parseFloat(piezasForm.peso_gramos),
      horas: parseInt(piezasForm.horas, 10),
      minutos: parseInt(piezasForm.minutos, 10),
      ancho_cm: piezasForm.ancho_cm ? parseFloat(piezasForm.ancho_cm) : null,
      alto_cm: piezasForm.alto_cm ? parseFloat(piezasForm.alto_cm) : null,
      profundidad_cm: piezasForm.profundidad_cm ? parseFloat(piezasForm.profundidad_cm) : null,
      imagen_principal_url: piezasForm.imagen_principal_url,
      es_multicolor: piezasForm.es_multicolor
    };

    if (piezasForm.id) {
      const piezaOriginal = piezas.find(p => p.id === piezasForm.id);
      if (piezaOriginal.categoria_id !== piezasForm.categoria_id) {
        const { data } = await supabase.rpc('obtener_siguiente_codigo', { p_categoria_id: piezasForm.categoria_id });
        if (data && data.length > 0) {
          payload.codigo = data[0].nuevo_codigo;
          payload.numero_correlativo = data[0].nuevo_correlativo;
        }
      }

      const { error } = await supabase.from('piezas').update(payload).eq('id', piezasForm.id);
      if (!error) {
        setSuccessMsg('¡Pieza actualizada con éxito!');
        limpiarFormulario();
        cargarDatos();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else alert(error.message);
    } else {
      payload.codigo = codigoGenerado;
      payload.numero_correlativo = numCorrelativo;

      const { error } = await supabase.from('piezas').insert([payload]);
      if (!error) {
        setSuccessMsg('¡Pieza guardada correctamente!');
        limpiarFormulario();
        cargarDatos();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else alert(error.message);
    }
  };

  const seleccionarParaEditar = (p) => {
    setPiezasForm({
      id: p.id,
      titulo: p.titulo,
      categoria_id: p.categoria_id,
      material_id: p.material_id,
      peso_gramos: p.peso_gramos,
      horas: p.horas,
      minutos: p.minutos,
      ancho_cm: p.ancho_cm || '',
      alto_cm: p.alto_cm || '',
      profundidad_cm: p.profundidad_cm || '',
      imagen_principal_url: p.imagen_principal_url || '',
      es_multicolor: p.es_multicolor || false
    });
    setCodigoGenerado(p.codigo);
    setActiveTab('anadir');
  };

  const limpiarFormulario = () => {
    setPiezasForm({
      id: null,
      titulo: '',
      categoria_id: categorias[0]?.id || '',
      material_id: materiales[0]?.id || '',
      peso_gramos: '',
      horas: '',
      minutos: '',
      ancho_cm: '',
      alto_cm: '',
      profundidad_cm: '',
      imagen_principal_url: '',
      es_multicolor: false
    });
    if (categorias[0]?.id) obtenerCodigoCategoria(categorias[0].id);
    setFormErrors([]);
  };

  const handleAdminAuth = (e) => {
    e.preventDefault();
    if (adminPinInput === '1234') {
      setIsAdmin(true);
      setShowAdminModal(false);
      setAdminPinInput('');
    } else alert('PIN Incorrecto');
  };

  const guardarConfiguracion = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('config_global').update({
      precio_energia_kwh: parseFloat(config.precio_energia_kwh),
      consumo_impresora_kw: parseFloat(config.consumo_impresora_kw),
      precio_impresora: parseFloat(config.precio_impresora),
      vida_util_horas: parseFloat(config.vida_util_horas),
      costo_servicio_hora: parseFloat(config.costo_servicio_hora),
      updated_at: new Date()
    }).eq('id', config.id);

    if (!error) alert('Configuración guardada');
  };

  const agregarMaterial = async (e) => {
    e.preventDefault();
    if (!nuevoMaterial.nombre || !nuevoMaterial.precio_kg) return;
    const { error } = await supabase.from('materiales').insert([
      { nombre: nuevoMaterial.nombre.toUpperCase(), precio_kg: parseFloat(nuevoMaterial.precio_kg) }
    ]);
    if (!error) {
      setNuevoMaterial({ nombre: '', precio_kg: '' });
      cargarDatos();
    }
  };

  const agregarCategoria = async (e) => {
    e.preventDefault();
    if (!nuevaCategoria.nombre || !nuevaCategoria.prefijo) return;
    const { error } = await supabase.from('categorias').insert([
      { nombre: nuevaCategoria.nombre, prefijo: nuevaCategoria.prefijo.toUpperCase() }
    ]);
    if (!error) {
      setNuevaCategoria({ nombre: '', prefijo: '' });
      cargarDatos();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white pb-20">
      
      {/* HEADER PRINCIPAL */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-50 flex justify-between items-center shadow-lg">
        <div className="flex items-center space-x-2">
          <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
            <Package className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              NiVa App
            </h1>
            <p className="text-[10px] text-slate-400">Calculadora & Gestión 3D</p>
          </div>
        </div>

        <button
          onClick={() => (isAdmin ? setIsAdmin(false) : setShowAdminModal(true))}
          className={`flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition border ${
            isAdmin 
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
        >
          {isAdmin ? <Unlock className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
          <span>{isAdmin ? 'Admin' : 'Usuario'}</span>
        </button>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-4 max-w-md mx-auto w-full">
        
        {/* NAVEGACIÓN SECUNDARIA ADMIN */}
        {isAdmin && (
          <div className="mb-5 bg-slate-900 p-1 rounded-xl border border-slate-800 flex justify-around">
            <button
              onClick={() => setActiveTab('cotizar')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${activeTab !== 'admin' ? 'bg-slate-800 text-emerald-400 shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Menú Principal
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${activeTab === 'admin' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Configuración Admin
            </button>
          </div>
        )}

        {/* ALERTA DE ÉXITO */}
        {successMsg && (
          <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl flex items-center space-x-2 text-emerald-300 text-xs">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* PESTAÑA: COTIZAR PIEZA (GRILLA 2X3 + BUSCADOR) */}
        {activeTab === 'cotizar' && (
          <div className="space-y-4">
            
            {/* BUSCADOR */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por nombre, código o categoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3.5 top-3.5 text-slate-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* GRILLA RESPONSIVE 2 COLUMNAS (3 FILAS VISIBLES SCROLLABLE) */}
            <div className="grid grid-cols-2 gap-3 max-h-[calc(100vh-210px)] overflow-y-auto pr-1">
              {piezasFiltradas.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-slate-500 text-xs">
                  No se encontraron piezas en el catálogo.
                </div>
              ) : (
                piezasFiltradas.map((p) => {
                  const estimativo = calcularCostosPieza(
                    p, 
                    p.nivel_servicio_estimativo || 2, 
                    p.margen_ganancia_estimativo || 50
                  );

                  return (
                    <div
                      key={p.id}
                      onClick={() => abrirModalCotizar(p)}
                      className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl overflow-hidden flex flex-col justify-between cursor-pointer transition group shadow-md"
                    >
                      {/* IMAGEN DE PORTADA */}
                      <div className="relative w-full aspect-square bg-slate-950 flex items-center justify-center overflow-hidden">
                        {p.imagen_principal_url ? (
                          <img src={p.imagen_principal_url} alt={p.titulo} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                        ) : (
                          <Package className="w-10 h-10 text-slate-700" />
                        )}

                        <span className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-sm text-emerald-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-800">
                          {p.codigo}
                        </span>

                        {p.es_multicolor && (
                          <span className="absolute top-2 right-2 bg-amber-500/20 text-amber-300 p-1 rounded-md border border-amber-500/30">
                            <Sparkles className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      {/* INFORMACIÓN Y PRECIO ESTIMATIVO */}
                      <div className="p-2.5 space-y-1">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500 block truncate">
                          {p.categorias?.nombre || 'General'}
                        </span>
                        <h3 className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300 transition line-clamp-1">
                          {p.titulo}
                        </h3>
                        <div className="pt-1 flex items-baseline justify-between border-t border-slate-800/80">
                          <span className="text-[10px] text-slate-400">Estimado</span>
                          <span className="text-sm font-extrabold text-emerald-400 font-mono">
                            ${estimativo.precioFinal.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* MODAL FICHA TÉCNICA Y SIMULADOR DE COTIZACIÓN */}
        {selectedPiezaModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
              
              {/* HEADER MODAL */}
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded">
                      {selectedPiezaModal.codigo}
                    </span>
                    <span className="text-xs text-slate-400">{selectedPiezaModal.categorias?.nombre}</span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-1">{selectedPiezaModal.titulo}</h3>
                </div>
                <button
                  onClick={() => setSelectedPiezaModal(null)}
                  className="bg-slate-800 text-slate-400 hover:text-white p-1.5 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* FOTO REPRESENTATIVA */}
              {selectedPiezaModal.imagen_principal_url && (
                <div className="w-full h-40 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
                  <img src={selectedPiezaModal.imagen_principal_url} alt="Vista" className="w-full h-full object-cover" />
                </div>
              )}

              {/* FICHA TÉCNICA */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center space-x-2">
                  <Weight className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="text-[10px] text-slate-500 block">Peso</span>
                    <span className="font-semibold text-slate-200">{selectedPiezaModal.peso_gramos} g</span>
                  </div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="text-[10px] text-slate-500 block">Tiempo</span>
                    <span className="font-semibold text-slate-200">{selectedPiezaModal.horas}h {selectedPiezaModal.minutos}m</span>
                  </div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center space-x-2">
                  <Tag className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="text-[10px] text-slate-500 block">Material</span>
                    <span className="font-semibold text-slate-200">{selectedPiezaModal.materiales?.nombre}</span>
                  </div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center space-x-2">
                  <Maximize2 className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="text-[10px] text-slate-500 block">Dimensiones</span>
                    <span className="font-semibold text-slate-200">
                      {selectedPiezaModal.ancho_cm || '-'} × {selectedPiezaModal.alto_cm || '-'} × {selectedPiezaModal.profundidad_cm || '-'} cm
                    </span>
                  </div>
                </div>
              </div>

              {/* CONTROLES DEL SIMULADOR DE PRECIO */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-emerald-400" /> Simular Cotización
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Nivel de Servicio</label>
                    <select
                      value={simNivelServicio}
                      onChange={(e) => setSimNivelServicio(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white"
                    >
                      <option value={1}>1 - Básico</option>
                      <option value={2}>2 - Estándar</option>
                      <option value={3}>3 - Express / Premium</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Margen Ganancia (%)</label>
                    <input
                      type="number"
                      value={simMargenGanancia}
                      onChange={(e) => setSimMargenGanancia(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white text-center font-mono"
                    />
                  </div>
                </div>

                {/* RESULTADO PRECIO CALCULADO */}
                {(() => {
                  const res = calcularCostosPieza(selectedPiezaModal, simNivelServicio, simMargenGanancia);
                  return (
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Subtotal Costo: ${Math.round(res.subtotal).toLocaleString()}</span>
                        <span className="text-xs font-bold text-slate-300">Precio Sugerido</span>
                      </div>
                      <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                        ${res.precioFinal.toLocaleString()}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* BOTÓN FIJAR COMO PRECIO ESTIMATIVO */}
              <button
                onClick={guardarValorEstimativo}
                disabled={savingEstimativo}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center space-x-2 transition shadow-lg shadow-emerald-950/50"
              >
                <Check className="w-4 h-4" />
                <span>Establecer como Precio Estimativo</span>
              </button>

            </div>
          </div>
        )}

        {/* PESTAÑA: AÑADIR PIEZA */}
        {(activeTab === 'anadir' || (piezasForm.id && activeTab !== 'editar')) && (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  {piezasForm.id ? <Edit3 className="w-5 h-5 text-amber-400" /> : <PlusCircle className="w-5 h-5 text-emerald-400" />}
                  {piezasForm.id ? 'Editar Pieza' : 'Añadir Nueva Pieza'}
                </h2>
                <p className="text-xs text-slate-400">
                  {piezasForm.id ? 'Modifica las características del diseño' : 'Carga los datos obligatorios para cotizar'}
                </p>
              </div>
              <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-lg text-xs font-mono font-bold">
                {codigoGenerado || 'CÓDIGO'}
              </span>
            </div>

            <form onSubmit={guardarPieza} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Nombre del Diseño / Pieza *</label>
                <input
                  type="text"
                  placeholder="Ej: Soporte Auriculares Gridfinity"
                  value={piezasForm.titulo}
                  onChange={(e) => setPiezasForm({ ...piezasForm, titulo: e.target.value })}
                  className={`w-full bg-slate-900 border rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 ${
                    formErrors.includes('Título de la pieza') ? 'border-rose-500 ring-rose-500/20' : 'border-slate-800 focus:ring-emerald-500/20 focus:border-emerald-500'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Categoría</label>
                  <select
                    value={piezasForm.categoria_id}
                    onChange={(e) => handleCategoriaChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} ({c.prefijo})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Material</label>
                  <select
                    value={piezasForm.material_id}
                    onChange={(e) => setPiezasForm({ ...piezasForm, material_id: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {materiales.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre} (${m.precio_kg}/kg)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-rose-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Datos Obligatorios para Costo
                  </span>
                  <span className="text-[10px] text-rose-400/80 uppercase font-bold tracking-wider">Requerido</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">Gramos *</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="gr"
                      value={piezasForm.peso_gramos}
                      onChange={(e) => setPiezasForm({ ...piezasForm, peso_gramos: e.target.value })}
                      className="w-full bg-slate-950 border border-rose-500/50 rounded-xl p-2.5 text-sm text-white font-mono text-center focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">Horas *</label>
                    <input
                      type="number"
                      placeholder="hs"
                      value={piezasForm.horas}
                      onChange={(e) => setPiezasForm({ ...piezasForm, horas: e.target.value })}
                      className="w-full bg-slate-950 border border-rose-500/50 rounded-xl p-2.5 text-sm text-white font-mono text-center focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">Minutos *</label>
                    <input
                      type="number"
                      max="59"
                      placeholder="min"
                      value={piezasForm.minutos}
                      onChange={(e) => setPiezasForm({ ...piezasForm, minutos: e.target.value })}
                      className="w-full bg-slate-950 border border-rose-500/50 rounded-xl p-2.5 text-sm text-white font-mono text-center focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Foto Representativa</label>
                <div className="flex gap-3 items-center">
                  {piezasForm.imagen_principal_url ? (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                      <img src={piezasForm.imagen_principal_url} alt="Portada" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPiezasForm({ ...piezasForm, imagen_principal_url: '' })}
                        className="absolute top-1 right-1 bg-slate-950/80 text-rose-400 p-1 rounded-full text-[10px]"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className="flex-1 bg-slate-900 border border-dashed border-slate-700 hover:border-emerald-500/50 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition">
                      {uploadingImage ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-400"></div>
                      ) : (
                        <>
                          <div className="flex gap-2 text-emerald-400 mb-1">
                            <Camera className="w-5 h-5" />
                            <Upload className="w-5 h-5" />
                          </div>
                          <span className="text-xs text-slate-400">Tomar foto o elegir imagen</span>
                          <span className="text-[10px] text-slate-500">Compresión automática WebP</span>
                        </>
                      )}
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  )}
                </div>
              </div>

              <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-xs font-medium text-slate-400 block">Dimensiones (Opcional)</span>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ancho (cm)"
                    value={piezasForm.ancho_cm}
                    onChange={(e) => setPiezasForm({ ...piezasForm, ancho_cm: e.target.value })}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white text-center"
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Alto (cm)"
                    value={piezasForm.alto_cm}
                    onChange={(e) => setPiezasForm({ ...piezasForm, alto_cm: e.target.value })}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white text-center"
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Prof (cm)"
                    value={piezasForm.profundidad_cm}
                    onChange={(e) => setPiezasForm({ ...piezasForm, profundidad_cm: e.target.value })}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white text-center"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium text-slate-200">Pieza Multicolor (AMS / ACE)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPiezasForm({ ...piezasForm, es_multicolor: !piezasForm.es_multicolor })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition ${piezasForm.es_multicolor ? 'bg-emerald-600 justify-end' : 'bg-slate-800 justify-start'}`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow"></div>
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                {piezasForm.id && (
                  <button
                    type="button"
                    onClick={limpiarFormulario}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-3 rounded-xl text-xs transition"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-xl text-xs shadow-lg shadow-emerald-950/50 transition"
                >
                  {piezasForm.id ? 'Guardar Cambios' : 'Guardar Pieza en Catálogo'}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* PESTAÑA: EDITAR PIEZA */}
        {activeTab === 'editar' && !piezasForm.id && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" /> Editar Pieza del Catálogo
              </h2>
              <p className="text-xs text-slate-400">Selecciona la pieza que deseas modificar</p>
            </div>

            <div className="space-y-2">
              {piezas.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">No hay piezas cargadas aún.</div>
              ) : (
                piezas.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => seleccionarParaEditar(p)}
                    className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 p-3 rounded-2xl flex items-center justify-between cursor-pointer transition group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {p.imagen_principal_url ? (
                          <img src={p.imagen_principal_url} alt={p.titulo} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-6 h-6 text-slate-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-bold text-emerald-400">{p.codigo}</span>
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">{p.categorias?.nombre}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-200 group-hover:text-emerald-300 transition line-clamp-1">{p.titulo}</h3>
                        <p className="text-[10px] text-slate-400">{p.peso_gramos}g • {p.horas}h {p.minutos}m • {p.materiales?.nombre}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition" />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA ADMIN (SÓLO ADMIN) */}
        {activeTab === 'admin' && isAdmin && config && (
          <div className="space-y-5">
            <h2 className="text-base font-bold text-emerald-400 flex items-center gap-2">
              <Settings className="w-5 h-5" /> Configuración Global de Costos
            </h2>

            <form onSubmit={guardarConfiguracion} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Precio Energía ($/kWh)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.precio_energia_kwh}
                  onChange={(e) => setConfig({ ...config, precio_energia_kwh: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Consumo Impresora (kW)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.consumo_impresora_kw}
                  onChange={(e) => setConfig({ ...config, consumo_impresora_kw: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Precio Impresora ($)</label>
                <input
                  type="number"
                  value={config.precio_impresora}
                  onChange={(e) => setConfig({ ...config, precio_impresora: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Vida Útil (Horas)</label>
                <input
                  type="number"
                  value={config.vida_util_horas}
                  onChange={(e) => setConfig({ ...config, vida_util_horas: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Costo Servicio/Hora ($/h)</label>
                <input
                  type="number"
                  value={config.costo_servicio_hora}
                  onChange={(e) => setConfig({ ...config, costo_servicio_hora: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold py-2.5 rounded-xl text-xs text-white transition">
                Guardar Constantes Globales
              </button>
            </form>

            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" /> Materiales y Precios por kg
              </h3>
              <div className="space-y-2">
                {materiales.map((m) => (
                  <div key={m.id} className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span className="font-semibold text-xs text-slate-300">{m.nombre}</span>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-slate-500">$</span>
                      <input
                        type="number"
                        defaultValue={m.precio_kg}
                        onBlur={async (e) => {
                          await supabase.from('materiales').update({ precio_kg: parseFloat(e.target.value) }).eq('id', m.id);
                          cargarDatos();
                        }}
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-right text-emerald-400 font-mono"
                      />
                      <span className="text-xs text-slate-500">/kg</span>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={agregarMaterial} className="flex gap-2 pt-2 border-t border-slate-800">
                <input
                  type="text"
                  placeholder="Material"
                  value={nuevoMaterial.nombre}
                  onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, nombre: e.target.value })}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white"
                />
                <input
                  type="number"
                  placeholder="$/kg"
                  value={nuevoMaterial.precio_kg}
                  onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, precio_kg: e.target.value })}
                  className="w-20 bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white"
                />
                <button type="submit" className="bg-emerald-600 px-3 py-2 rounded-xl text-xs font-bold">+</button>
              </form>
            </div>

            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-200">Categorías y Prefijos</h3>
              <div className="space-y-2">
                {categorias.map((c) => (
                  <div key={c.id} className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
                    <span className="font-medium text-slate-300">{c.nombre}</span>
                    <span className="bg-emerald-950 text-emerald-400 px-2.5 py-1 rounded-lg font-mono font-bold border border-emerald-900">
                      {c.prefijo}
                    </span>
                  </div>
                ))}
              </div>
              <form onSubmit={agregarCategoria} className="flex gap-2 pt-2 border-t border-slate-800">
                <input
                  type="text"
                  placeholder="Categoría"
                  value={nuevaCategoria.nombre}
                  onChange={(e) => setNuevaCategoria({ ...nuevaCategoria, nombre: e.target.value })}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Prefijo"
                  value={nuevaCategoria.prefijo}
                  onChange={(e) => setNuevaCategoria({ ...nuevaCategoria, prefijo: e.target.value })}
                  className="w-20 bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white"
                />
                <button type="submit" className="bg-emerald-600 px-3 py-2 rounded-xl text-xs font-bold">+</button>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* MODAL PIN ADMIN */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 max-w-xs w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-center text-white">Ingreso Administrador</h3>
            <form onSubmit={handleAdminAuth} className="space-y-3">
              <input
                type="password"
                placeholder="PIN (1234)"
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-center text-xl font-mono text-white focus:outline-none focus:border-emerald-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="flex-1 bg-slate-800 py-2.5 rounded-xl text-xs font-semibold text-slate-300"
                >
                  Cancelar
                </button>
                <button type="submit" className="flex-1 bg-emerald-600 py-2.5 rounded-xl text-xs font-bold text-white">
                  Ingresar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NAVEGACIÓN INFERIOR PWA */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 py-2 px-3 flex justify-around items-center z-40">
        <button
          onClick={() => setActiveTab('cotizar')}
          className={`flex flex-col items-center space-y-1 transition ${activeTab === 'cotizar' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Calculator className="w-5 h-5" />
          <span className="text-[10px] font-medium">Cotizar</span>
        </button>
        <button
          onClick={() => { limpiarFormulario(); setActiveTab('anadir'); }}
          className={`flex flex-col items-center space-y-1 transition ${activeTab === 'anadir' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <PlusCircle className="w-5 h-5" />
          <span className="text-[10px] font-medium">Añadir</span>
        </button>
        <button
          onClick={() => { limpiarFormulario(); setActiveTab('editar'); }}
          className={`flex flex-col items-center space-y-1 transition ${activeTab === 'editar' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Edit3 className="w-5 h-5" />
          <span className="text-[10px] font-medium">Editar</span>
        </button>
        <button
          onClick={() => setActiveTab('venta')}
          className={`flex flex-col items-center space-y-1 transition ${activeTab === 'venta' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[10px] font-medium">Venta</span>
        </button>
        <button
          onClick={() => setActiveTab('estadisticas')}
          className={`flex flex-col items-center space-y-1 transition ${activeTab === 'estadisticas' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <BarChart2 className="w-5 h-5" />
          <span className="text-[10px] font-medium">Stats</span>
        </button>
      </nav>

    </div>
  );
}