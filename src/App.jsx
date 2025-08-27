
import * as React from 'react';
import { useState } from 'react';
import { AppBar, Toolbar, Typography, Container, Tabs, Tab, Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, List, ListItem, ListItemText, Snackbar, Alert } from '@mui/material';
import { Add as AddIcon, Event as EventIcon, People as PeopleIcon } from '@mui/icons-material';
import { LocalizationProvider, DatePicker, TimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { openDB } from 'idb';

const DB_NAME = 'podologia_agenda';
const DB_VERSION = 2;
const STORE_PATIENTS = 'patients';
const STORE_VISITS = 'visits';

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_PATIENTS)) {
        db.createObjectStore(STORE_PATIENTS, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_VISITS)) {
        db.createObjectStore(STORE_VISITS, { keyPath: 'id', autoIncrement: true });
      } else if (db.objectStoreNames.contains(STORE_VISITS)) {
        // Migración: agregar campos de informe clínico si no existen
        // IndexedDB no permite alterar stores, pero los objetos pueden tener más campos
      }
    },
  });
}

function App() {
  const [tab, setTab] = useState(0);
  const [patients, setPatients] = useState([]);
  const [visits, setVisits] = useState([]);
  const [openPatientDialog, setOpenPatientDialog] = useState(false);
  const [openVisitDialog, setOpenVisitDialog] = useState(false);
  const [newPatient, setNewPatient] = useState({ name: '', phone: '', address: '' });
  const [newVisit, setNewVisit] = useState({ patientId: '', date: '', notes: '', diagnostico: '', tratamiento: '', observaciones: '' });
  const [openInformeDialog, setOpenInformeDialog] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [informe, setInforme] = useState({ diagnostico: '', tratamiento: '', observaciones: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  React.useEffect(() => {
    loadPatients();
    loadVisits();
  }, []);

  async function loadPatients() {
    const db = await getDB();
    const tx = db.transaction(STORE_PATIENTS, 'readonly');
    const store = tx.objectStore(STORE_PATIENTS);
    const all = await store.getAll();
    setPatients(all);
  }

  async function loadVisits() {
    const db = await getDB();
    const tx = db.transaction(STORE_VISITS, 'readonly');
    const store = tx.objectStore(STORE_VISITS);
    const all = await store.getAll();
    setVisits(all);
  }

  async function handleAddPatient() {
    if (!newPatient.name) {
      setSnackbar({ open: true, message: 'Nombre requerido', severity: 'error' });
      return;
    }
    const db = await getDB();
    const tx = db.transaction(STORE_PATIENTS, 'readwrite');
    const store = tx.objectStore(STORE_PATIENTS);
    await store.add(newPatient);
    setNewPatient({ name: '', phone: '', address: '' });
    setOpenPatientDialog(false);
    setSnackbar({ open: true, message: 'Paciente agregado', severity: 'success' });
    loadPatients();
  }

  async function handleAddVisit() {
    if (!newVisit.patientId || !newVisit.date) {
      setSnackbar({ open: true, message: 'Paciente y fecha requeridos', severity: 'error' });
      return;
    }
    const db = await getDB();
    const tx = db.transaction(STORE_VISITS, 'readwrite');
    const store = tx.objectStore(STORE_VISITS);
    await store.add({ ...newVisit, diagnostico: '', tratamiento: '', observaciones: '' });
    setNewVisit({ patientId: '', date: '', notes: '', diagnostico: '', tratamiento: '', observaciones: '' });
    setOpenVisitDialog(false);
    setSnackbar({ open: true, message: 'Visita agendada', severity: 'success' });
    loadVisits();
  }

  // Guardar informe clínico
  async function handleSaveInforme() {
    if (!selectedVisit) return;
    const db = await getDB();
    const tx = db.transaction(STORE_VISITS, 'readwrite');
    const store = tx.objectStore(STORE_VISITS);
    const updated = { ...selectedVisit, ...informe };
    await store.put(updated);
    setOpenInformeDialog(false);
    setSnackbar({ open: true, message: 'Informe clínico guardado', severity: 'success' });
    setSelectedVisit(null);
    setInforme({ diagnostico: '', tratamiento: '', observaciones: '' });
    loadVisits();
  }

  // Función para eliminar paciente
  async function handleDeletePatient(id) {
    const db = await getDB();
    const tx = db.transaction(STORE_PATIENTS, 'readwrite');
    const store = tx.objectStore(STORE_PATIENTS);
    await store.delete(id);
    setSnackbar({ open: true, message: 'Paciente eliminado', severity: 'info' });
    loadPatients();
    // Eliminar visitas asociadas
    const txVisits = db.transaction(STORE_VISITS, 'readwrite');
    const storeVisits = txVisits.objectStore(STORE_VISITS);
    const allVisits = await storeVisits.getAll();
    for (const v of allVisits) {
      if (v.patientId === id) await storeVisits.delete(v.id);
    }
    loadVisits();
  }

  // Función para eliminar visita
  async function handleDeleteVisit(id) {
    const db = await getDB();
    const tx = db.transaction(STORE_VISITS, 'readwrite');
    const store = tx.objectStore(STORE_VISITS);
    await store.delete(id);
    setSnackbar({ open: true, message: 'Visita eliminada', severity: 'info' });
    loadVisits();
  }

  return (
    <Box sx={{ flexGrow: 1, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Agenda de Podología
          </Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} centered>
          <Tab icon={<PeopleIcon />} label="Pacientes" />
          <Tab icon={<EventIcon />} label="Visitas" />
        </Tabs>
        {tab === 0 && (
          <Box sx={{ mt: 3 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenPatientDialog(true)}>
              Agregar Paciente
            </Button>
            <List sx={{ mt: 2, bgcolor: 'white', borderRadius: 2 }}>
              {patients.length === 0 && <ListItem><ListItemText primary="Sin pacientes registrados" /></ListItem>}
              {patients.map((p) => (
                <ListItem key={p.id} divider
                  secondaryAction={
                    <Button color="error" size="small" onClick={() => handleDeletePatient(p.id)}>
                      Eliminar
                    </Button>
                  }
                >
                  <ListItemText
                    primary={<span style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{p.name || 'Sin nombre'}</span>}
                    secondary={
                      <>
                        {p.phone && <span>Tel: {p.phone}<br /></span>}
                        {p.address && (
                          <span>
                            Dirección: <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline' }}>{p.address}</a>
                          </span>
                        )}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
        {tab === 1 && (
          <Box sx={{ mt: 3 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenVisitDialog(true)}>
              Agendar Visita
            </Button>
            <List sx={{ mt: 2, bgcolor: 'white', borderRadius: 2 }}>
              {visits.length === 0 && <ListItem><ListItemText primary="Sin visitas agendadas" /></ListItem>}
              {visits.map((v) => {
                const patient = patients.find((p) => p.id === v.patientId);
                return (
                  <ListItem key={v.id} divider
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button color="primary" size="small" onClick={() => {
                          setSelectedVisit(v);
                          setInforme({
                            diagnostico: v.diagnostico || '',
                            tratamiento: v.tratamiento || '',
                            observaciones: v.observaciones || ''
                          });
                          setOpenInformeDialog(true);
                        }}>
                          Informe
                        </Button>
                        <Button color="error" size="small" onClick={() => handleDeleteVisit(v.id)}>
                          Eliminar
                        </Button>
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={patient ? patient.name : 'Paciente eliminado'}
                      secondary={
                        <>
                          {`Fecha: ${v.date} ${v.notes ? ' | Notas: ' + v.notes : ''}`}
                          {(v.diagnostico || v.tratamiento || v.observaciones) && (
                            <Box sx={{ mt: 1, fontSize: '0.95em', color: '#444' }}>
                              <b>Diagnóstico:</b> {v.diagnostico || '-'}<br />
                              <b>Tratamiento:</b> {v.tratamiento || '-'}<br />
                              <b>Observaciones:</b> {v.observaciones || '-'}
                            </Box>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          </Box>
        )}
      </Container>

      {/* Diálogo para agregar paciente */}
      <Dialog open={openPatientDialog} onClose={() => setOpenPatientDialog(false)}>
        <DialogTitle>Agregar Paciente</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nombre"
            fullWidth
            value={newPatient.name}
            onChange={e => setNewPatient({ ...newPatient, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Teléfono"
            fullWidth
            value={newPatient.phone}
            onChange={e => setNewPatient({ ...newPatient, phone: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Dirección"
            fullWidth
            value={newPatient.address}
            onChange={e => setNewPatient({ ...newPatient, address: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPatientDialog(false)}>Cancelar</Button>
          <Button onClick={handleAddPatient} variant="contained">Guardar</Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo para agendar visita con calendario y hora */}
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Dialog open={openVisitDialog} onClose={() => setOpenVisitDialog(false)}>
          <DialogTitle>Agendar Visita</DialogTitle>
          <DialogContent>
            <TextField
              select
              label="Paciente"
              fullWidth
              SelectProps={{ native: true }}
              value={newVisit.patientId}
              onChange={e => setNewVisit({ ...newVisit, patientId: Number(e.target.value) })}
              sx={{ mt: 2 }}
            >
              <option value="">Seleccione un paciente</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </TextField>
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <DatePicker
                label="Fecha"
                value={newVisit.date || null}
                onChange={date => setNewVisit({ ...newVisit, date })}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
              <TimePicker
                label="Hora"
                value={newVisit.time || null}
                onChange={time => setNewVisit({ ...newVisit, time })}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </Box>
            <TextField
              label="Comentario / Evento / Causalidad"
              fullWidth
              multiline
              minRows={2}
              value={newVisit.notes}
              onChange={e => setNewVisit({ ...newVisit, notes: e.target.value })}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenVisitDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddVisit} variant="contained">Guardar</Button>
          </DialogActions>
        </Dialog>
      </LocalizationProvider>

      {/* Diálogo para informe clínico */}
      <Dialog open={openInformeDialog} onClose={() => setOpenInformeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Informe Clínico</DialogTitle>
        <DialogContent>
          <TextField
            label="Diagnóstico"
            fullWidth
            multiline
            minRows={2}
            value={informe.diagnostico}
            onChange={e => setInforme({ ...informe, diagnostico: e.target.value })}
            sx={{ mt: 1 }}
          />
          <TextField
            label="Tratamiento"
            fullWidth
            multiline
            minRows={2}
            value={informe.tratamiento}
            onChange={e => setInforme({ ...informe, tratamiento: e.target.value })}
            sx={{ mt: 2 }}
          />
          <TextField
            label="Observaciones"
            fullWidth
            multiline
            minRows={2}
            value={informe.observaciones}
            onChange={e => setInforme({ ...informe, observaciones: e.target.value })}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenInformeDialog(false)}>Cancelar</Button>
          <Button onClick={handleSaveInforme} variant="contained">Guardar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

export default App;
