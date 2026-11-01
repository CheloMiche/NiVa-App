import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Settings, Tag, Package, Calculator, PlusCircle, Edit3, ShoppingCart, BarChart2, Lock, Unlock } from 'lucide-react';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [activeTab, setActiveTab] = useState('cotizar');

  // Estados de Configuración Global (Admin)
  const [config, setConfig] = useState({
    precio_energia_kwh: 0,
    consumo_impresora_kw: 0,
    precio_impresora: 0,
    vida_util_horas: 0,
    costo_servicio_hora: 0
  });

  // Estados de Tablas
  const [materiales, setMateriales] = useState([]);
  const [categorias, setCategorias] = useState([]);
  
  // Nuevos ítems a agregar en Admin
  const [nuevoMaterial, setNuevoMaterial] = useState({ nombre: '', precio_kg: '' });
  const [nuevaCategoria, setNuevaCategoria] = useState({ nombre: '', prefijo: '' });

  useEffect(() => {
    cargarDatosAdmin();
  }, []);

  const cargarDatosAdmin = async () => {
    // Configuración global
    const { data: cfg } = await supabase.from('config_global').select('*').single();
    if (cfg) setConfig(cfg);

    // Materiales
    const { data: mat } = await supabase.from('materiales').select('*').order('nombre');
    if (mat) setMateriales(mat);

    // Categorías
    const { data: cat } = await supabase.from('categorias').select('*').order('nombre');
    if (cat) setCategorias(cat);
  };

  const handleAdminAuth = (e) => {
    e.preventDefault();
    // Clave temporal de Admin. Podés cambiarla después si querés.
    if (adminPinInput === '1234') {
      setIsAdmin(true);
      setShowAdminModal(false);
      setAdminPinInput('');
    } else {
      alert('PIN Incorrecto');
    }
  };

  const guardarConfiguracion = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from('config_global')
      .update({
        precio_energia_kwh: parseFloat(config.precio_energia_kwh),
        consumo_impresora_kw: parseFloat(config.consumo_impresora_kw),
        precio_impresora: parseFloat(config.precio_impresora),
        vida_util_horas: parseFloat(config.vida_util_horas),
        costo_servicio_hora: parseFloat(config.costo_servicio_hora),
        updated_at: new Date()
      })
      .eq('id', config.id);

    if (error) alert('Error al guardar configuración');
    else alert('Configuración guardada exitosamente');
  };

  const agregarMaterial = async (e) => {
    e.preventDefault();
    if (!nuevoMaterial.nombre || !nuevoMaterial.precio_kg) return;
    const { error } = await supabase.from('materiales').insert([
      { nombre: nuevoMaterial.nombre.toUpperCase(), precio_kg: parseFloat(nuevoMaterial.precio_kg) }
    ]);
    if (!error) {
      setNuevoMaterial({ nombre: '', precio_kg: '' });
      cargarDatosAdmin();
    } else alert(error.message);
  };

  const actualizarPrecioMaterial = async (id, nuevoPrecio) => {
    const { error } = await supabase
      .from('materiales')
      .update({ precio_kg: parseFloat(nuevoPrecio) })
      .eq('id', id);
    if (!error) cargarDatosAdmin();
  };

  const agregarCategoria = async (e) => {
    e.preventDefault();
    if (!nuevaCategoria.nombre || !nuevaCategoria.prefijo) return;
    const { error } = await supabase.from('categorias').insert([
      { nombre: nuevaCategoria.nombre, prefijo: nuevaCategoria.prefijo.toUpperCase() }
    ]);
    if (!error) {
      setNuevaCategoria({ nombre: '', prefijo: '' });
      cargarDatosAdmin();
    } else alert(error.message);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* BARRA SUPERIOR / HEADER */}
      <header className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center space-x-2">
          <Package className="w-7 h-7 text-emerald-400" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
            NiVa App
          </h1>
        </div>
        <button
          onClick={() => (isAdmin ? setIsAdmin(false) : setShowAdminModal(true))}
          className={`flex items-center space-x-1 text-xs px-3 py-1.5 rounded-full font-medium transition ${
            isAdmin ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-700 text-slate-300'
          }`}
        >
          {isAdmin ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          <span>{isAdmin ? 'Modo Admin' : 'Modo Usuario'}</span>
        </button>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-4 max-w-md mx-auto w-full pb-24">
        {/* NAVEGACIÓN SECUNDARIA SI ES ADMIN */}
        {isAdmin && (
          <div className="mb-4 bg-slate-800 p-1.5 rounded-xl border border-slate-700 flex justify-around">
            <button
              onClick={() => setActiveTab('cotizar')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg ${activeTab !== 'admin' ? 'bg-slate-700 text-emerald-400' : 'text-slate-400'}`}
            >
              Menú Usuario
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg ${activeTab === 'admin' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
            >
              Panel Admin
            </button>
          </div>
        )}

        {/* VISTA SEGÚN PESTAÑA */}
        {activeTab === 'admin' && isAdmin ? (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
              <Settings className="w-5 h-5" /> Configuración Global de Costos
            </h2>

            {/* FORMULARIO CONSTANTES GLOBALES */}
            <form onSubmit={guardarConfiguracion} className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
              <div>
                <label className="text-xs text-slate-400">Precio Energía ($/kWh)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.precio_energia_kwh}
                  onChange={(e) => setConfig({ ...config, precio_energia_kwh: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Consumo Impresora (kW)</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.consumo_impresora_kw}
                  onChange={(e) => setConfig({ ...config, consumo_impresora_kw: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Precio Impresora ($)</label>
                <input
                  type="number"
                  value={config.precio_impresora}
                  onChange={(e) => setConfig({ ...config, precio_impresora: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Vida Útil (Horas)</label>
                <input
                  type="number"
                  value={config.vida_util_horas}
                  onChange={(e) => setConfig({ ...config, vida_util_horas: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Costo Servicio/Hora ($/h)</label>
                <input
                  type="number"
                  value={config.costo_servicio_hora}
                  onChange={(e) => setConfig({ ...config, costo_servicio_hora: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 font-semibold py-2 rounded-lg text-sm transition">
                Guardar Constantes
              </button>
            </form>

            {/* GESTIÓN DE MATERIALES */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" /> Materiales y Precios por kg
              </h3>
              <div className="space-y-2">
                {materiales.map((m) => (
                  <div key={m.id} className="flex justify-between items-center bg-slate-900 p-2.5 rounded-lg border border-slate-700">
                    <span className="font-semibold text-sm">{m.nombre}</span>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-slate-400">$</span>
                      <input
                        type="number"
                        defaultValue={m.precio_kg}
                        onBlur={(e) => actualizarPrecioMaterial(m.id, e.target.value)}
                        className="w-24 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-right"
                      />
                      <span className="text-xs text-slate-400">/kg</span>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={agregarMaterial} className="flex gap-2 pt-2 border-t border-slate-700">
                <input
                  type="text"
                  placeholder="Material (ej: ABS)"
                  value={nuevoMaterial.nombre}
                  onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, nombre: e.target.value })}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs"
                />
                <input
                  type="number"
                  placeholder="Precio $/kg"
                  value={nuevoMaterial.precio_kg}
                  onChange={(e) => setNuevoMaterial({ ...nuevoMaterial, precio_kg: e.target.value })}
                  className="w-24 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs"
                />
                <button type="submit" className="bg-emerald-600 px-3 py-2 rounded-lg text-xs font-semibold">
                  +
                </button>
              </form>
            </div>

            {/* GESTIÓN DE CATEGORÍAS */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-4">
              <h3 className="text-sm font-bold text-slate-200">Categorías y Prefijos</h3>
              <div className="space-y-2">
                {categorias.map((c) => (
                  <div key={c.id} className="flex justify-between items-center bg-slate-900 p-2.5 rounded-lg border border-slate-700 text-xs">
                    <span className="font-medium">{c.nombre}</span>
                    <span className="bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded font-mono font-bold border border-emerald-800">
                      {c.prefijo}
                    </span>
                  </div>
                ))}
              </div>
              <form onSubmit={agregarCategoria} className="flex gap-2 pt-2 border-t border-slate-700">
                <input
                  type="text"
                  placeholder="Categoría"
                  value={nuevaCategoria.nombre}
                  onChange={(e) => setNuevaCategoria({ ...nuevaCategoria, nombre: e.target.value })}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="Prefijo (ej: MAC)"
                  value={nuevaCategoria.prefijo}
                  onChange={(e) => setNuevaCategoria({ ...nuevaCategoria, prefijo: e.target.value })}
                  className="w-24 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs"
                />
                <button type="submit" className="bg-emerald-600 px-3 py-2 rounded-lg text-xs font-semibold">
                  +
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 space-y-3">
            <Calculator className="w-12 h-12 mx-auto text-emerald-400 opacity-60" />
            <p className="text-sm">Sección del menú de usuarios en construcción para el Paso 5.</p>
          </div>
        )}
      </main>

      {/* MODAL AUTENTICACIÓN ADMIN */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 max-w-xs w-full space-y-4">
            <h3 className="text-base font-bold text-center text-white">Ingreso Administrador</h3>
            <form onSubmit={handleAdminAuth} className="space-y-3">
              <input
                type="password"
                placeholder="Ingresar PIN (1234)"
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-center text-lg font-mono text-white focus:outline-none focus:border-emerald-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="flex-1 bg-slate-700 py-2.5 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button type="submit" className="flex-1 bg-emerald-600 py-2.5 rounded-xl text-xs font-semibold">
                  Acceder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NAVEGACIÓN INFERIOR (MENÚ USUARIO) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 py-2 px-4 flex justify-around items-center z-40">
        <button
          onClick={() => setActiveTab('cotizar')}
          className={`flex flex-col items-center space-y-1 ${activeTab === 'cotizar' ? 'text-emerald-400' : 'text-slate-400'}`}
        >
          <Calculator className="w-5 h-5" />
          <span className="text-[10px]">Cotizar</span>
        </button>
        <button
          onClick={() => setActiveTab('anadir')}
          className={`flex flex-col items-center space-y-1 ${activeTab === 'anadir' ? 'text-emerald-400' : 'text-slate-400'}`}
        >
          <PlusCircle className="w-5 h-5" />
          <span className="text-[10px]">Añadir</span>
        </button>
        <button
          onClick={() => setActiveTab('editar')}
          className={`flex flex-col items-center space-y-1 ${activeTab === 'editar' ? 'text-emerald-400' : 'text-slate-400'}`}
        >
          <Edit3 className="w-5 h-5" />
          <span className="text-[10px]">Editar</span>
        </button>
        <button
          onClick={() => setActiveTab('venta')}
          className={`flex flex-col items-center space-y-1 ${activeTab === 'venta' ? 'text-emerald-400' : 'text-slate-400'}`}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[10px]">Venta</span>
        </button>
        <button
          onClick={() => setActiveTab('estadisticas')}
          className={`flex flex-col items-center space-y-1 ${activeTab === 'estadisticas' ? 'text-emerald-400' : 'text-slate-400'}`}
        >
          <BarChart2 className="w-5 h-5" />
          <span className="text-[10px]">Stats</span>
        </button>
      </nav>
    </div>
  );
}