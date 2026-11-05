import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { compressAndUploadImage } from './imageUtils';
import { 
  Settings, Tag, Package, Calculator, PlusCircle, Edit3, 
  ShoppingCart, BarChart2, Lock, Unlock, Camera, Upload, 
  AlertCircle, CheckCircle2, ChevronRight, Sparkles, Search, 
  X, Clock, Weight, Maximize2, Check, UserCheck, DollarSign, Wallet, KeyRound, Trash2,
  ClipboardList, CheckSquare, Square, Wrench, User, ArrowRight, Percent, AlertTriangle
} from 'lucide-react';

export default function App() {
  // CLAVES Y PINS (PIN Usuario: '3130' | PIN Admin: '1001')
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);
  const [userPinInput, setUserPinInput] = useState('');
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [showAdminModal, setShowAdminModal] = useState(false);
  
  const [activeTab, setActiveTab] = useState('pedidos');

  // Estados Base
  const [config, setConfig] = useState(null);
  const [materiales, setMateriales] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [piezas, setPiezas] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [pedidos, setPedidos] = useState([]);

  // Buscador y Cotizador
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPiezaModal, setSelectedPiezaModal] = useState(null);
  const [simNivelServicio, setSimNivelServicio] = useState(2);
  const [simMargenGanancia, setSimMargenGanancia] = useState(50);
  const [savingEstimativo, setSavingEstimativo] = useState(false);

  // Formulario Cargar Pedido
  const [pedidoForm, setPedidoForm] = useState({
    cliente: '',
    prioridad: 'Media',
    recibido_por: 'Papi',
    tipo_pieza: 'existente', // 'existente' o 'nuevo'
    pieza_id: null,
    pieza_seleccionada: null,
    descripcion_nuevo: '',
    colores_solicitados: ''
  });
  const [searchPiezaPedido, setSearchPiezaPedido] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Modales de Cotización y Reemplazo
  const [pedidoCotizando, setPedidoCotizando] = useState(null);
  const [precioCotizadoManual, setPrecioCotizadoManual] = useState('');
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState(0);

  const [pedidoReemplazando, setPedidoReemplazando] = useState(null);
  const [searchReemplazar, setSearchReemplazar] = useState('');

  // Formulario Añadir / Editar Pieza
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

  // Formulario Venta (Con Fabricante)
  const [ventaForm, setVentaForm] = useState({
    pedido_id: null,
    pieza_id: '',
    vendedor: 'Papi',
    fabricante: 'NiVa',
    precio_cobrado: ''
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
    try {
      const { data: cfg } = await supabase.from('config_global').select('*');
      if (cfg && cfg.length > 0) setConfig(cfg[0]);
      else {
        setConfig({
          id: 1,
          precio_energia_kwh: 250,
          consumo_impresora_kw: 0.15,
          precio_impresora: 650000,
          vida_util_horas: 3000,
          costo_servicio_basico: 1000,
          costo_servicio_estandar: 1500,
          costo_servicio_premium: 2500
        });
      }

      const { data: mat } = await supabase.from('materiales').select('*').order('nombre');
      let defaultMaterialId = '';
      if (mat) {
        setMateriales(mat);
        const plaMat = mat.find(m => m.nombre.toUpperCase() === 'PLA');
        defaultMaterialId = plaMat ? plaMat.id : (mat[0]?.id || '');
        if (!piezasForm.material_id) setPiezasForm(prev => ({ ...prev, material_id: defaultMaterialId }));
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

      const { data: vts } = await supabase.from('ventas').select('*, piezas(*)').order('created_at', { ascending: false });
      if (vts) setVentas(vts);

      const { data: pds } = await supabase.from('pedidos').select('*, piezas(*)').order('created_at', { ascending: true });
      if (pds) setPedidos(pds);

    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const obtenerCodigoCategoria = async (catId) => {
    if (!catId) return;
    const { data, error } = await supabase.rpc('obtener_siguiente_codigo', { p_categoria_id: catId });
    if (!error && data && data.length > 0) {
      setCodigoGenerado(data[0].nuevo_codigo);
    }
  };

  const calcularCostosPieza = (pieza, nivelServicio = 2, margenGanancia = 50, listaMats = materiales) => {
    if (!pieza || !config) return { costoMaterial: 0, costoEnergia: 0, costoAmortizacion: 0, costoServicio: 0, subtotal: 0, precioFinal: 0, montoGanancia: 0 };

    const material = pieza.materiales || (listaMats || materiales).find(m => m.id === pieza.material_id);
    const precioKg = material ? parseFloat(material.precio_kg) : 0;
    
    const costoMaterial = (parseFloat(pieza.peso_gramos) / 1000) * precioKg;
    const tiempoHoras = parseFloat(pieza.horas) + (parseFloat(pieza.minutos) / 60);
    const costoEnergia = tiempoHoras * parseFloat(config.consumo_impresora_kw) * parseFloat(config.precio_energia_kwh);
    const costoAmortizacion = config.vida_util_horas > 0 
      ? (parseFloat(config.precio_impresora) / parseFloat(config.vida_util_horas)) * tiempoHoras 
      : 0;

    let tarifaServicioHora = parseFloat(config.costo_servicio_estandar || 1500);
    if (parseInt(nivelServicio, 10) === 1) tarifaServicioHora = parseFloat(config.costo_servicio_basico || 1000);
    else if (parseInt(nivelServicio, 10) === 3) tarifaServicioHora = parseFloat(config.costo_servicio_premium || 2500);

    const costoServicio = tiempoHoras * tarifaServicioHora;
    const subtotal = costoMaterial + costoEnergia + costoAmortizacion + costoServicio;
    const montoGanancia = subtotal * (parseFloat(margenGanancia) / 100);
    const precioFinal = subtotal + montoGanancia;

    return {
      costoMaterial,
      costoEnergia,
      costoAmortizacion,
      costoServicio,
      subtotal,
      montoGanancia,
      precioFinal: Math.round(precioFinal)
    };
  };

  // CÁLCULO DE DESCUENTO AFECTANDO ÚNICAMENTE AL COSTO DE SERVICIO
  const calcularPrecioConDescuentoServicio = (pieza, descPorcentaje) => {
    if (!pieza) return 0;
    const calc = calcularCostosPieza(pieza, pieza.nivel_servicio_estimativo || 2, pieza.margen_ganancia_estimativo || 50);
    const descuentoMonto = calc.costoServicio * (parseFloat(descPorcentaje || 0) / 100);
    const servicioConDescuento = Math.max(0, calc.costoServicio - descuentoMonto);
    const subtotalAjustado = calc.costoMaterial + calc.costoEnergia + calc.costoAmortizacion + servicioConDescuento;
    const precioFinalAjustado = subtotalAjustado + calc.montoGanancia;
    return Math.round(precioFinalAjustado);
  };

  // REGISTRO DE NUEVO PEDIDO
  const registrarPedido = async (e) => {
    e.preventDefault();
    if (!pedidoForm.cliente.trim()) {
      alert('Ingresá el Nombre y Apellido del cliente.');
      return;
    }

    if (pedidoForm.tipo_pieza === 'existente' && !pedidoForm.pieza_id) {
      alert('Seleccioná una pieza del catálogo.');
      return;
    }

    const payload = {
      cliente: pedidoForm.cliente.trim(),
      prioridad: pedidoForm.prioridad,
      recibido_por: pedidoForm.recibido_por,
      pieza_id: pedidoForm.tipo_pieza === 'existente' ? pedidoForm.pieza_id : null,
      descripcion_nuevo: pedidoForm.tipo_pieza === 'nuevo' ? pedidoForm.descripcion_nuevo : null,
      colores_solicitados: pedidoForm.colores_solicitados,
      estado: 'Sin cotizar',
      precio_cotizado: 0,
      descuento: 0
    };

    const { error } = await supabase.from('pedidos').insert([payload]);
    if (!error) {
      setSuccessMsg('¡Pedido guardado en la lista!');
      setPedidoForm({
        cliente: '',
        prioridad: 'Media',
        recibido_por: 'Papi',
        tipo_pieza: 'existente',
        pieza_id: null,
        pieza_seleccionada: null,
        descripcion_nuevo: '',
        colores_solicitados: ''
      });
      setSearchPiezaPedido('');
      cargarDatos();
      setTimeout(() => setSuccessMsg(''), 3000);
    } else alert(error.message);
  };

  // BOTÓN 1: ABRIR MODAL COTIZAR
  const abrirModalCotizarPedido = (pd) => {
    setPedidoCotizando(pd);
    if (pd.piezas) {
      const precioSugerido = calcularCostosPieza(
        pd.piezas, 
        pd.piezas.nivel_servicio_estimativo || 2, 
        pd.piezas.margen_ganancia_estimativo || 50
      ).precioFinal;
      setPrecioCotizadoManual(pd.precio_cotizado > 0 ? pd.precio_cotizado : precioSugerido);
    } else {
      setPrecioCotizadoManual(pd.precio_cotizado || '');
    }
    setDescuentoPorcentaje(pd.descuento || 0);
  };

  const confirmarCotizacionPedido = async () => {
    if (!pedidoCotizando) return;
    const { error } = await supabase.from('pedidos').update({
      estado: 'Cotizado',
      precio_cotizado: parseFloat(precioCotizadoManual || 0),
      descuento: parseFloat(descuentoPorcentaje || 0)
    }).eq('id', pedidoCotizando.id);

    if (!error) {
      setSuccessMsg('¡Pedido cotizado con éxito!');
      setPedidoCotizando(null);
      cargarDatos();
      setTimeout(() => setSuccessMsg(''), 3000);
    } else alert(error.message);
  };

  // BOTÓN 2: GESTIONAR APROBACIÓN
  const cambiarEstadoAprobacion = async (pd, aprobado) => {
    if (aprobado) {
      const { error } = await supabase.from('pedidos').update({ estado: 'Aprobado' }).eq('id', pd.id);
      if (!error) cargarDatos();
    } else {
      if (window.confirm(`¿Deseas descartar/eliminar el pedido de ${pd.cliente}?`)) {
        const { error } = await supabase.from('pedidos').delete().eq('id', pd.id);
        if (!error) {
          setSuccessMsg('Pedido descartado.');
          cargarDatos();
          setTimeout(() => setSuccessMsg(''), 3000);
        }
      }
    }
  };

  // BOTÓN 3: REGISTRAR FABRICACIÓN Y TRANSFERIR A VENTAS
  const registrarFabricacionYTransferir = async (pd) => {
    if (!pd.pieza_id) {
      alert('Para fabricar el pedido, primero debes asignarle una pieza del catálogo existente.');
      setPedidoReemplazando(pd);
      return;
    }

    // Actualizar pedido a Fabricado
    const { error: errPedido } = await supabase.from('pedidos').update({ estado: 'Fabricado' }).eq('id', pd.id);
    if (errPedido) {
      alert(errPedido.message);
      return;
    }

    // Cargar en ventaForm y redirigir a Pestaña Venta
    setVentaForm({
      pedido_id: pd.id,
      pieza_id: pd.pieza_id,
      vendedor: pd.recibido_por || 'Papi',
      fabricante: 'NiVa',
      precio_cobrado: pd.precio_cotizado
    });

    setActiveTab('venta');
    setSuccessMsg('¡Pedido fabricado! Finalizá el registro asignando los roles en Venta.');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // REEMPLAZAR DISEÑO NUEVO POR PIEZA DEL CATÁLOGO
  const reemplazarDiseñoNuevo = async (piezaSel) => {
    if (!pedidoReemplazando) return;
    const { error } = await supabase.from('pedidos').update({
      pieza_id: piezaSel.id,
      descripcion_nuevo: null
    }).eq('id', pedidoReemplazando.id);

    if (!error) {
      setSuccessMsg(`¡Diseño actualizado a "${piezaSel.titulo}"!`);
      setPedidoReemplazando(null);
      cargarDatos();
      setTimeout(() => setSuccessMsg(''), 3000);
    } else alert(error.message);
  };

  // REGISTRO DEFINITIVO EN VENTA
  const registrarVenta = async (e) => {
    e.preventDefault();
    if (!ventaForm.pieza_id || !ventaForm.precio_cobrado) return;

    const piezaSel = piezas.find(p => p.id === ventaForm.pieza_id);
    const calc = calcularCostosPieza(piezaSel, piezaSel.nivel_servicio_estimativo || 2, piezaSel.margen_ganancia_estimativo || 50);

    const precioCobrado = parseFloat(ventaForm.precio_cobrado);
    const costoInsumos = calc.costoMaterial + calc.costoEnergia + calc.costoAmortizacion;
    const montoServicio = calc.costoServicio;
    const gananciaVendedor = precioCobrado > calc.subtotal ? (precioCobrado - calc.subtotal) : calc.montoGanancia;

    const { error } = await supabase.from('ventas').insert([{
      pieza_id: ventaForm.pieza_id,
      vendedor: ventaForm.vendedor,
      fabricante: ventaForm.fabricante,
      precio_cobrado: precioCobrado,
      costo_insumos: costoInsumos,
      costo_servicio: montoServicio,
      monto_ganancia_vendedor: gananciaVendedor,
      liquidado: false
    }]);

    if (!error) {
      // Si venía de un pedido fabricado, eliminarlo o archivarlo
      if (ventaForm.pedido_id) {
        await supabase.from('pedidos').delete().eq('id', ventaForm.pedido_id);
      }
      setSuccessMsg('¡Venta registrada con éxito!');
      setVentaForm({ pedido_id: null, pieza_id: '', vendedor: 'Papi', fabricante: 'NiVa', precio_cobrado: '' });
      cargarDatos();
      setActiveTab('estadisticas');
      setTimeout(() => setSuccessMsg(''), 3000);
    } else alert(error.message);
  };

  // AGRUPACIÓN Y ORDENAMIENTO DE PEDIDOS (PRIORIDAD ALTA POR CLIENTE + FECHA MÁS ANTIGUA)
  const obtenerPedidosProcesados = () => {
    // 1. Mapear prioridades más altas por cliente (Coincidencia Exacta Nombre y Apellido)
    const prioridadesPorCliente = {};
    const pesoPrioridad = { 'Alta': 3, 'Media': 2, 'Baja': 1 };

    pedidos.forEach(p => {
      const clienteKey = p.cliente.trim().toLowerCase();
      const prioActual = p.prioridad || 'Media';
      if (!prioridadesPorCliente[clienteKey] || pesoPrioridad[prioActual] > pesoPrioridad[prioridadesPorCliente[clienteKey]]) {
        prioridadesPorCliente[clienteKey] = prioActual;
      }
    });

    // 2. Asignar prioridad máxima del grupo a cada pedido
    const pedidosConPrioridadGrupo = pedidos.map(p => {
      const clienteKey = p.cliente.trim().toLowerCase();
      return {
        ...p,
        prioridadEfectiva: prioridadesPorCliente[clienteKey] || p.prioridad || 'Media'
      };
    });

    // 3. Ordenar: Prioridad Alta > Media > Baja, y luego fecha más antigua
    return pedidosConPrioridadGrupo.sort((a, b) => {
      const diffPrio = pesoPrioridad[b.prioridadEfectiva] - pesoPrioridad[a.prioridadEfectiva];
      if (diffPrio !== 0) return diffPrio;
      return new Date(a.created_at) - new Date(b.created_at);
    });
  };

  const resumenStats = () => {
    const acumulados = { Papi: 0, Nadia: 0, Valen: 0, Nico: 0, NiVa: 0, totalVentas: 0 };
    ventas.filter(v => !v.liquidado).forEach(v => {
      acumulados.totalVentas += parseFloat(v.precio_cobrado || 0);
      const vend = v.vendedor;
      if (acumulados[vend] !== undefined) acumulados[vend] += parseFloat(v.monto_ganancia_vendedor || 0);
      const fab = v.fabricante || 'NiVa';
      if (fab === 'Nico' || fab === 'Valen') acumulados[fab] += parseFloat(v.costo_servicio || 0);
      else acumulados.NiVa += parseFloat(v.costo_servicio || 0);
      acumulados.NiVa += parseFloat(v.costo_insumos || 0);
    });
    return acumulados;
  };

  const liquidarCaja = async () => {
    if (window.confirm('¿Deseas liquidar el período actual? Las cuentas acumuladas de todos volverán a cero.')) {
      const { error } = await supabase.from('ventas').update({ liquidado: true }).eq('liquidado', false);
      if (!error) {
        setSuccessMsg('¡Caja distribuida y saldos reseteados a cero!');
        cargarDatos();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else alert(error.message);
    }
  };

  const abrirModalCotizar = (p) => {
    setSelectedPiezaModal(p);
    setSimNivelServicio(p.nivel_servicio_estimativo || 2);
    setSimMargenGanancia(p.margen_ganancia_estimativo !== undefined ? p.margen_ganancia_estimativo : 50);
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

  const piezasFiltradas = piezas.filter(p => {
    const term = searchTerm.toLowerCase();
    return p.titulo.toLowerCase().includes(term) || 
           p.codigo.toLowerCase().includes(term) || 
           p.categorias?.nombre?.toLowerCase().includes(term);
  });

  const piezasParaPedido = piezas.filter(p => {
    const term = searchPiezaPedido.toLowerCase();
    return p.titulo.toLowerCase().includes(term) || 
           p.codigo.toLowerCase().includes(term) || 
           p.categorias?.nombre?.toLowerCase().includes(term);
  });

  const piezasParaReemplazar = piezas.filter(p => {
    const term = searchReemplazar.toLowerCase();
    return p.titulo.toLowerCase().includes(term) || 
           p.codigo.toLowerCase().includes(term) || 
           p.categorias?.nombre?.toLowerCase().includes(term);
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
      const url = await compressAndUploadImage(file);
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
    const plaMat = materiales.find(m => m.nombre.toUpperCase() === 'PLA');
    const defaultMatId = plaMat ? plaMat.id : (materiales[0]?.id || '');

    setPiezasForm({
      id: null,
      titulo: '',
      categoria_id: categorias[0]?.id || '',
      material_id: defaultMatId,
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

  const handleUserAuth = (e) => {
    e.preventDefault();
    if (userPinInput === '3130') {
      setIsUserAuthenticated(true);
      setUserPinInput('');
    } else alert('PIN Incorrecto');
  };

  const handleAdminAuth = (e) => {
    e.preventDefault();
    if (adminPinInput === '1001') {
      setIsAdmin(true);
      setActiveTab('admin');
      setShowAdminModal(false);
      setAdminPinInput('');
    } else alert('PIN Admin Incorrecto');
  };

  const guardarConfiguracion = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('config_global').update({
      precio_energia_kwh: parseFloat(config.precio_energia_kwh),
      consumo_impresora_kw: parseFloat(config.consumo_impresora_kw),
      precio_impresora: parseFloat(config.precio_impresora),
      vida_util_horas: parseFloat(config.vida_util_horas),
      costo_servicio_basico: parseFloat(config.costo_servicio_basico || 1000),
      costo_servicio_estandar: parseFloat(config.costo_servicio_estandar || 1500),
      costo_servicio_premium: parseFloat(config.costo_servicio_premium || 2500),
      updated_at: new Date()
    }).eq('id', config.id);

    if (!error) alert('Configuración guardada exitosamente');
    else alert(error.message);
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
    } else alert(error.message);
  };

  const actualizarMaterial = async (id, campos) => {
    const { error } = await supabase.from('materiales').update(campos).eq('id', id);
    if (!error) cargarDatos();
    else alert(error.message);
  };

  const eliminarMaterial = async (id, nombre) => {
    if (window.confirm(`¿Seguro que querés eliminar el material "${nombre}"?`)) {
      const { error } = await supabase.from('materiales').delete().eq('id', id);
      if (!error) cargarDatos();
      else alert(error.message);
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
    } else alert(error.message);
  };

  const actualizarCategoria = async (id, campos) => {
    const { error } = await supabase.from('categorias').update(campos).eq('id', id);
    if (!error) cargarDatos();
    else alert(error.message);
  };

  const eliminarCategoria = async (id, nombre) => {
    if (window.confirm(`¿Seguro que querés eliminar la categoría "${nombre}"?`)) {
      const { error } = await supabase.from('categorias').delete().eq('id', id);
      if (!error) cargarDatos();
      else alert(error.message);
    }
  };

  const stats = resumenStats();
  const pedidosProcesados = obtenerPedidosProcesados();

  if (!isUserAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 max-w-xs w-full space-y-5 shadow-2xl text-center">
          <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 w-fit mx-auto">
            <KeyRound className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">NiVa App 3D</h2>
            <p className="text-xs text-slate-400 mt-1">Ingresá el PIN de acceso para acceder a la aplicación</p>
          </div>
          <form onSubmit={handleUserAuth} className="space-y-4" autoComplete="off">
            <input
              type="password"
              name="user_pin_code"
              placeholder="PIN de Usuario"
              value={userPinInput}
              onChange={(e) => setUserPinInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-center text-xl font-mono text-white focus:outline-none focus:border-emerald-500"
              autoComplete="new-password"
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-2xl text-xs shadow-lg transition"
            >
              Ingresar a NiVa App
            </button>
          </form>
        </div>
      </div>
    );
  }

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
          onClick={() => {
            if (isAdmin) {
              setIsAdmin(false);
              if (activeTab === 'admin') setActiveTab('pedidos');
            } else {
              setShowAdminModal(true);
            }
          }}
          className={`flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition border ${
            isAdmin 
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
        >
          {isAdmin ? <Unlock className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
          <span>{isAdmin ? 'Admin Activo' : 'Ingreso Admin'}</span>
        </button>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-4 max-w-md mx-auto w-full">

        {/* ALERTA DE ÉXITO */}
        {successMsg && (
          <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl flex items-center space-x-2 text-emerald-300 text-xs">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* PESTAÑA 1: MÓDULO DE PEDIDOS */}
        {activeTab === 'pedidos' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-emerald-400" /> Cargar Nuevo Pedido
              </h2>
              <p className="text-xs text-slate-400">Asigna prioridad, cliente y cotización secuencial</p>
            </div>

            {/* FORMULARIO DE CARGA */}
            <form onSubmit={registrarPedido} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3 shadow-lg">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Cliente (Nombre y Apellido) *</label>
                  <input
                    type="text"
                    placeholder="Ej: Marcelo Michelini"
                    value={pedidoForm.cliente}
                    onChange={(e) => setPedidoForm({ ...pedidoForm, cliente: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Prioridad</label>
                  <select
                    value={pedidoForm.prioridad}
                    onChange={(e) => setPedidoForm({ ...pedidoForm, prioridad: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-bold"
                  >
                    <option value="Alta" className="text-rose-400">🔴 Alta</option>
                    <option value="Media" className="text-amber-400">🟡 Media</option>
                    <option value="Baja" className="text-slate-400">⚪ Baja</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Recibido por</label>
                  <select
                    value={pedidoForm.recibido_por}
                    onChange={(e) => setPedidoForm({ ...pedidoForm, recibido_por: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                  >
                    {['Papi', 'Nadia', 'Valen', 'Nico'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Tipo de Pieza</label>
                  <select
                    value={pedidoForm.tipo_pieza}
                    onChange={(e) => setPedidoForm({ ...pedidoForm, tipo_pieza: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                  >
                    <option value="existente">Catálogo Existente</option>
                    <option value="nuevo">Nuevo Diseño a Buscar</option>
                  </select>
                </div>
              </div>

              {/* BUSCADOR PREDICTIVO IGUAL A COTIZAR */}
              {pedidoForm.tipo_pieza === 'existente' ? (
                <div className="relative">
                  <label className="text-xs font-medium text-slate-300 block mb-1">Pieza del Catálogo</label>
                  {pedidoForm.pieza_seleccionada ? (
                    <div className="flex justify-between items-center bg-slate-950 border border-emerald-500/50 p-2.5 rounded-xl text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-emerald-400 font-bold">{pedidoForm.pieza_seleccionada.codigo}</span>
                        <span className="text-white">{pedidoForm.pieza_seleccionada.titulo}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPedidoForm({ ...pedidoForm, pieza_id: null, pieza_seleccionada: null })}
                        className="text-slate-400 hover:text-rose-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Buscar por nombre, código o categoría..."
                          value={searchPiezaPedido}
                          onChange={(e) => {
                            setSearchPiezaPedido(e.target.value);
                            setShowSearchDropdown(true);
                          }}
                          onFocus={() => setShowSearchDropdown(true)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white"
                        />
                      </div>

                      {showSearchDropdown && searchPiezaPedido && (
                        <div className="absolute top-full left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl mt-1 max-h-48 overflow-y-auto z-50 shadow-2xl space-y-1 p-1">
                          {piezasParaPedido.length === 0 ? (
                            <div className="p-2 text-center text-xs text-slate-500">Sin coincidencias</div>
                          ) : (
                            piezasParaPedido.map(p => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setPedidoForm({ ...pedidoForm, pieza_id: p.id, pieza_seleccionada: p });
                                  setShowSearchDropdown(false);
                                  setSearchPiezaPedido('');
                                }}
                                className="p-2 hover:bg-slate-800 rounded-lg cursor-pointer flex justify-between items-center text-xs"
                              >
                                <div>
                                  <span className="font-mono text-emerald-400 font-bold mr-2">{p.codigo}</span>
                                  <span className="text-slate-200">{p.titulo}</span>
                                </div>
                                <span className="text-[10px] bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded">{p.categorias?.nombre}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Leyenda Descriptiva / Nombre a Buscar</label>
                  <input
                    type="text"
                    placeholder="Ej: Llavero personalizado nombre 'Lucas'"
                    value={pedidoForm.descripcion_nuevo}
                    onChange={(e) => setPedidoForm({ ...pedidoForm, descripcion_nuevo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Colores Solicitados (Texto a mano)</label>
                <input
                  type="text"
                  placeholder="Ej: Negro matte con letras doradas"
                  value={pedidoForm.colores_solicitados}
                  onChange={(e) => setPedidoForm({ ...pedidoForm, colores_solicitados: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md"
              >
                + Cargar Pedido
              </button>
            </form>

            {/* LISTA DE PEDIDOS SECUENCIALES */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                <span>Lista de Pedidos ({pedidosProcesados.length})</span>
                <span className="text-[10px] text-slate-500 font-normal">Orden: Prioridad &gt; Antigüedad</span>
              </h3>

              {pedidosProcesados.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">No hay pedidos registrados en la lista.</div>
              ) : (
                pedidosProcesados.map((pd) => {
                  const esCotizado = pd.estado === 'Cotizado' || pd.estado === 'Aprobado' || pd.estado === 'Fabricado';
                  const esAprobado = pd.estado === 'Aprobado' || pd.estado === 'Fabricado';
                  const esFabricado = pd.estado === 'Fabricado';

                  return (
                    <div key={pd.id} className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl space-y-3 shadow-md">
                      
                      {/* ENCABEZADO Y CLIENTE */}
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              pd.prioridadEfectiva === 'Alta' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                              pd.prioridadEfectiva === 'Media' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                              'bg-slate-800 text-slate-400'
                            }`}>
                              Prioridad {pd.prioridadEfectiva}
                            </span>
                            <span className="text-xs font-bold text-white">{pd.cliente}</span>
                          </div>

                          <div className="mt-1">
                            {pd.piezas ? (
                              <div className="flex items-center space-x-1">
                                <span className="font-mono text-xs text-emerald-400 font-bold">{pd.piezas.codigo}</span>
                                <span className="text-xs text-slate-200">{pd.piezas.titulo}</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-amber-300 italic">{pd.descripcion_nuevo || 'Nuevo Diseño'}</span>
                                <button
                                  onClick={() => { setPedidoReemplazando(pd); setSearchReemplazar(''); }}
                                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30"
                                >
                                  Asignar Pieza
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-extrabold text-emerald-400 font-mono block">
                            ${pd.precio_cotizado > 0 ? pd.precio_cotizado.toLocaleString() : 'Sin Cotizar'}
                          </span>
                          <span className="text-[10px] text-slate-500">{new Date(pd.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {pd.colores_solicitados && (
                        <p className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded-xl border border-slate-800/80">
                          🎨 Color: <span className="text-slate-200">{pd.colores_solicitados}</span>
                        </p>
                      )}

                      {/* SECUENCIA DE 3 BOTONES DE ACCIÓN */}
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800">
                        
                        {/* BOTÓN 1: COTIZAR */}
                        <button
                          onClick={() => abrirModalCotizarPedido(pd)}
                          className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition flex items-center justify-center space-x-1 ${
                            esCotizado 
                              ? 'bg-emerald-600 border-emerald-500 text-white' 
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <Calculator className="w-3.5 h-3.5" />
                          <span>{pd.precio_cotizado > 0 ? 'Cotizado' : 'Cotizar'}</span>
                        </button>

                        {/* BOTÓN 2: GESTIONAR APROBACIÓN */}
                        <div className="flex gap-1">
                          <button
                            onClick={() => cambiarEstadoAprobacion(pd, true)}
                            disabled={!esCotizado}
                            className={`flex-1 py-2 rounded-xl text-[11px] font-bold border transition flex items-center justify-center ${
                              esAprobado 
                                ? 'bg-emerald-600 border-emerald-500 text-white' 
                                : !esCotizado 
                                  ? 'bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed'
                                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-emerald-950 hover:text-emerald-300'
                            }`}
                          >
                            Aprobar
                          </button>
                          {esCotizado && !esAprobado && (
                            <button
                              onClick={() => cambiarEstadoAprobacion(pd, false)}
                              className="px-2 bg-rose-950 border border-rose-800 text-rose-300 rounded-xl text-[10px] font-bold hover:bg-rose-900"
                              title="No Aprobado (Eliminar)"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* BOTÓN 3: REGISTRAR FABRICACIÓN */}
                        <button
                          onClick={() => registrarFabricacionYTransferir(pd)}
                          disabled={!esAprobado}
                          className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition flex items-center justify-center space-x-1 ${
                            esFabricado 
                              ? 'bg-emerald-600 border-emerald-500 text-white' 
                              : !esAprobado 
                                ? 'bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-emerald-950 border-emerald-800 text-emerald-300 hover:bg-emerald-900'
                          }`}
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>Fabricar</span>
                        </button>

                      </div>

                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA: COTIZAR PIEZA */}
        {activeTab === 'cotizar' && (
          <div className="space-y-4">
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
                    p.margen_ganancia_estimativo !== undefined ? p.margen_ganancia_estimativo : 50
                  );

                  return (
                    <div
                      key={p.id}
                      onClick={() => abrirModalCotizar(p)}
                      className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl overflow-hidden flex flex-col justify-between cursor-pointer transition group shadow-md"
                    >
                      <div className="relative w-full aspect-square bg-slate-950 flex items-center justify-center overflow-hidden p-1">
                        {p.imagen_principal_url ? (
                          <img src={p.imagen_principal_url} alt={p.titulo} className="w-full h-full object-contain group-hover:scale-105 transition duration-300" />
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

        {/* PESTAÑA: REGISTRAR VENTA */}
        {activeTab === 'venta' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-400" /> Registrar Nueva Venta
              </h2>
              <p className="text-xs text-slate-400">Asigna la ganancia al vendedor y el servicio al fabricante</p>
            </div>

            <form onSubmit={registrarVenta} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-4 shadow-lg">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Pieza Vendida</label>
                <select
                  value={ventaForm.pieza_id}
                  onChange={(e) => setVentaForm({ ...ventaForm, pieza_id: e.target.value })}
                  disabled={!!ventaForm.pedido_id}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-70"
                >
                  {piezas.map(p => (
                    <option key={p.id} value={p.id}>{p.codigo} - {p.titulo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-emerald-400" /> ¿Quién Vendió? (Lleva la Ganancia)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['Papi', 'Nadia', 'Valen', 'Nico'].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVentaForm({ ...ventaForm, vendedor: v })}
                      className={`py-2 text-xs font-bold rounded-xl border transition ${
                        ventaForm.vendedor === v 
                          ? 'bg-emerald-600 border-emerald-500 text-white' 
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1 flex items-center gap-1">
                  <Wrench className="w-3.5 h-3.5 text-amber-400" /> ¿Quién Fabricó? (Lleva el Servicio $/h)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Nico', 'Valen', 'NiVa'].map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setVentaForm({ ...ventaForm, fabricante: f })}
                      className={`py-2 text-xs font-bold rounded-xl border transition ${
                        ventaForm.fabricante === f 
                          ? 'bg-amber-600 border-amber-500 text-white' 
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {f === 'NiVa' ? 'Empresa (NiVa)' : f}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Precio Cobrado Final ($)</label>
                <input
                  type="number"
                  value={ventaForm.precio_cobrado}
                  onChange={(e) => setVentaForm({ ...ventaForm, precio_cobrado: e.target.value })}
                  readOnly={!!ventaForm.pedido_id}
                  className={`w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-base text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500 ${
                    ventaForm.pedido_id ? 'opacity-70 bg-slate-900 border-emerald-500/30' : ''
                  }`}
                />
                {ventaForm.pedido_id && (
                  <span className="text-[10px] text-emerald-400 mt-1 block">🔒 Precio fijado en la cotización del pedido</span>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 rounded-xl text-xs shadow-lg shadow-emerald-950/50 transition"
              >
                Confirmar y Registrar Venta
              </button>
            </form>
          </div>
        )}

        {/* PESTAÑA: ESTADÍSTICAS Y REPARTO DE CAJA */}
        {activeTab === 'estadisticas' && (
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-emerald-400" /> Balance y Reparto de Caja
                </h2>
                <p className="text-xs text-slate-400">Acumulados pendientes de pago en cuenta común</p>
              </div>
              <button
                onClick={liquidarCaja}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition shadow-md flex items-center space-x-1"
              >
                <span>Liquidar Caja</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { nombre: 'Nico', monto: stats.Nico },
                { nombre: 'Valen', monto: stats.Valen },
                { nombre: 'Nadia', monto: stats.Nadia },
                { nombre: 'Papi', monto: stats.Papi },
              ].map((user) => (
                <div key={user.nombre} className="bg-slate-900 p-3 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 block">{user.nombre} (Venta + Fabricación)</span>
                  <p className="text-lg font-extrabold text-white font-mono">${Math.round(user.monto).toLocaleString()}</p>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="flex items-center space-x-1.5 text-slate-400 text-xs">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Caja Chica NiVa (Insumos + Servicios Empresa)</span>
              </div>
              <p className="text-2xl font-extrabold text-emerald-400 font-mono">${Math.round(stats.NiVa).toLocaleString()}</p>
              <span className="text-[10px] text-slate-500">Monto reservado para reposición de filamento, energía y mantenimiento</span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ventas Pendientes de Liquidar</h3>
              {ventas.filter(v => !v.liquidado).length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">No hay ventas pendientes de liquidar.</div>
              ) : (
                ventas.filter(v => !v.liquidado).map((v) => (
                  <div key={v.id} className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white">{v.piezas?.titulo || 'Pieza'}</span>
                      <div className="flex space-x-2 text-[10px] text-slate-400">
                        <span>Vendió: {v.vendedor}</span>
                        <span>•</span>
                        <span>Fabricó: {v.fabricante || 'NiVa'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-emerald-400">${v.precio_cobrado}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        )}

        {/* MODAL COTIZAR PEDIDO (REGLA DESCUENTO EXCLUSIVO EN SERVICIO) */}
        {pedidoCotizando && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase">Cotizando Pedido</span>
                  <h3 className="text-sm font-bold text-white">{pedidoCotizando.cliente}</h3>
                </div>
                <button onClick={() => setPedidoCotizando(null)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {pedidoCotizando.piezas && (
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pieza:</span>
                    <span className="font-bold text-white">{pedidoCotizando.piezas.titulo}</span>
                  </div>
                  {(() => {
                    const c = calcularCostosPieza(pedidoCotizando.piezas, pedidoCotizando.piezas.nivel_servicio_estimativo || 2, pedidoCotizando.piezas.margen_ganancia_estimativo || 50);
                    return (
                      <div className="space-y-1 text-[11px] border-t border-slate-800/80 pt-2">
                        <div className="flex justify-between text-slate-400">
                          <span>Material + Energía + Amort:</span>
                          <span>${Math.round(c.costoMaterial + c.costoEnergia + c.costoAmortizacion)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Ganancia Vendedor (Protegida):</span>
                          <span>${Math.round(c.montoGanancia)}</span>
                        </div>
                        <div className="flex justify-between text-amber-400 font-bold">
                          <span>Mano de Obra Servicio ($/h):</span>
                          <span>${Math.round(c.costoServicio)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="space-y-3">
                {pedidoCotizando.piezas && (
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">Descuento al Servicio (%)</label>
                    <div className="flex gap-2">
                      {[0, 10, 20, 30, 50].map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setDescuentoPorcentaje(d);
                            const precioAjustado = calcularPrecioConDescuentoServicio(pedidoCotizando.piezas, d);
                            setPrecioCotizadoManual(precioAjustado);
                          }}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${
                            descuentoPorcentaje === d ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          {d}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Precio Final Cotizado ($)</label>
                  <input
                    type="number"
                    value={precioCotizadoManual}
                    onChange={(e) => setPrecioCotizadoManual(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-lg font-mono font-bold text-emerald-400 text-center"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPedidoCotizando(null)}
                  className="flex-1 bg-slate-800 py-2.5 rounded-xl text-xs font-bold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarCotizacionPedido}
                  className="flex-1 bg-emerald-600 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg"
                >
                  Confirmar Cotización
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL REEMPLAZAR DISEÑO NUEVO POR PIEZA DE CATÁLOGO */}
        {pedidoReemplazando && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] text-amber-400 font-bold uppercase">Asignar Pieza del Catálogo</span>
                  <h3 className="text-sm font-bold text-white">{pedidoReemplazando.descripcion_nuevo}</h3>
                </div>
                <button onClick={() => setPedidoReemplazando(null)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar diseño en el catálogo..."
                  value={searchReemplazar}
                  onChange={(e) => setSearchReemplazar(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {piezasParaReemplazar.map(p => (
                  <div
                    key={p.id}
                    onClick={() => reemplazarDiseñoNuevo(p)}
                    className="p-2.5 bg-slate-950 border border-slate-800 hover:border-emerald-500 rounded-xl cursor-pointer flex justify-between items-center text-xs"
                  >
                    <div>
                      <span className="font-mono text-emerald-400 font-bold mr-2">{p.codigo}</span>
                      <span className="text-slate-200">{p.titulo}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setPedidoReemplazando(null)}
                className="w-full bg-slate-800 py-2 rounded-xl text-xs text-slate-400"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* MODAL DETALLE & COTIZADOR EN CATÁLOGO */}
        {selectedPiezaModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
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

              {selectedPiezaModal.imagen_principal_url && (
                <div className="w-full h-48 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden p-2 flex items-center justify-center">
                  <img src={selectedPiezaModal.imagen_principal_url} alt="Vista" className="w-full h-full object-contain" />
                </div>
              )}

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
              </div>

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
                      <option value={1}>1 - Básico (${config?.costo_servicio_basico || 1000}/h)</option>
                      <option value={2}>2 - Estándar (${config?.costo_servicio_estandar || 1500}/h)</option>
                      <option value={3}>3 - Express (${config?.costo_servicio_premium || 2500}/h)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Margen Ganancia</label>
                    <select
                      value={simMargenGanancia}
                      onChange={(e) => setSimMargenGanancia(parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white font-mono text-center"
                    >
                      {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((m) => (
                        <option key={m} value={m}>{m}%</option>
                      ))}
                    </select>
                  </div>
                </div>

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
                  <label className="text-xs font-medium text-slate-300 block mb-1">Material (Defecto: PLA)</label>
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
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 p-1 flex items-center justify-center">
                      <img src={piezasForm.imagen_principal_url} alt="Portada" className="w-full h-full object-contain" />
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

        {/* PESTAÑA: ADMIN */}
        {activeTab === 'admin' && isAdmin && (
          <div className="space-y-5">
            <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
              <Settings className="w-5 h-5" /> Panel de Configuración Global
            </h2>

            {config ? (
              <form onSubmit={guardarConfiguracion} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-slate-300">Constantes de Costo de Equipo</h3>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Precio Energía ($/kWh)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.precio_energia_kwh || ''}
                      onChange={(e) => setConfig({ ...config, precio_energia_kwh: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Consumo (kW)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.consumo_impresora_kw || ''}
                      onChange={(e) => setConfig({ ...config, consumo_impresora_kw: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Precio Impresora ($)</label>
                    <input
                      type="number"
                      value={config.precio_impresora || ''}
                      onChange={(e) => setConfig({ ...config, precio_impresora: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Vida Útil (Horas)</label>
                    <input
                      type="number"
                      value={config.vida_util_horas || ''}
                      onChange={(e) => setConfig({ ...config, vida_util_horas: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <h3 className="text-xs font-bold text-emerald-400 mb-2">Tarifas de Servicio $/Hora</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-0.5">Servicio Básico ($/h)</label>
                      <input
                        type="number"
                        value={config.costo_servicio_basico || ''}
                        onChange={(e) => setConfig({ ...config, costo_servicio_basico: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-0.5">Servicio Estándar ($/h)</label>
                      <input
                        type="number"
                        value={config.costo_servicio_estandar || ''}
                        onChange={(e) => setConfig({ ...config, costo_servicio_estandar: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-0.5">Servicio Express / Premium ($/h)</label>
                      <input
                        type="number"
                        value={config.costo_servicio_premium || ''}
                        onChange={(e) => setConfig({ ...config, costo_servicio_premium: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold py-2.5 rounded-xl text-xs text-white transition">
                  Guardar Tarifas y Constantes
                </button>
              </form>
            ) : (
              <div className="text-xs text-slate-500 text-center py-4">Cargando configuración...</div>
            )}

            {/* TABLA MATERIALES */}
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" /> Materiales y Precios por kg
              </h3>
              <div className="space-y-2">
                {materiales.map((m) => (
                  <div key={m.id} className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800 gap-2">
                    <input
                      type="text"
                      defaultValue={m.nombre}
                      onBlur={(e) => actualizarMaterial(m.id, { nombre: e.target.value.toUpperCase() })}
                      className="bg-transparent text-xs font-semibold text-slate-300 focus:outline-none focus:border-b border-emerald-500 flex-1"
                    />
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-slate-500">$</span>
                      <input
                        type="number"
                        defaultValue={m.precio_kg}
                        onBlur={(e) => actualizarMaterial(m.id, { precio_kg: parseFloat(e.target.value) })}
                        className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-right text-emerald-400 font-mono"
                      />
                      <span className="text-xs text-slate-500">/kg</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => eliminarMaterial(m.id, m.nombre)}
                      className="text-slate-600 hover:text-rose-400 p-1 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <form onSubmit={agregarMaterial} className="flex gap-2 pt-2 border-t border-slate-800">
                <input
                  type="text"
                  placeholder="Nuevo Material"
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

            {/* TABLA CATEGORÍAS */}
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-200">Categorías y Prefijos</h3>
              <div className="space-y-2">
                {categorias.map((c) => (
                  <div key={c.id} className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800 gap-2">
                    <input
                      type="text"
                      defaultValue={c.nombre}
                      onBlur={(e) => actualizarCategoria(c.id, { nombre: e.target.value })}
                      className="bg-transparent text-xs font-medium text-slate-300 focus:outline-none focus:border-b border-emerald-500 flex-1"
                    />
                    <input
                      type="text"
                      defaultValue={c.prefijo}
                      onBlur={(e) => actualizarCategoria(c.id, { prefijo: e.target.value.toUpperCase() })}
                      className="w-16 bg-emerald-950 text-emerald-400 text-center font-mono font-bold text-xs py-1 rounded border border-emerald-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => eliminarCategoria(c.id, c.nombre)}
                      className="text-slate-600 hover:text-rose-400 p-1 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <form onSubmit={agregarCategoria} className="flex gap-2 pt-2 border-t border-slate-800">
                <input
                  type="text"
                  placeholder="Nueva Categoría"
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
            <form onSubmit={handleAdminAuth} className="space-y-3" autoComplete="off">
              <input
                type="password"
                name="admin_pin_code"
                placeholder="PIN Admin"
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-center text-xl font-mono text-white focus:outline-none focus:border-emerald-500"
                autoComplete="new-password"
                autoFocus
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
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 py-2 px-1 flex justify-around items-center z-40">
        <button
          onClick={() => setActiveTab('pedidos')}
          className={`flex flex-col items-center space-y-1 transition ${activeTab === 'pedidos' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <ClipboardList className="w-5 h-5" />
          <span className="text-[10px] font-medium">Pedidos</span>
        </button>
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

        {isAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center space-y-1 transition ${activeTab === 'admin' ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Settings className="w-5 h-5 text-amber-400" />
            <span className="text-[10px] font-bold text-amber-400">Admin</span>
          </button>
        )}
      </nav>

    </div>
  );
}