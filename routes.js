const { json } = require('express');
const express = require('express');
const { as } = require('pg-promise');
const pgp = require('pg-promise')();

const router = express.Router();

router.use(express.json());

const db = pgp ({
  database: 'weather',
  user: 'postgres',
});



router.get('/states', async (req, res) => {
    res.json(await db.many('SELECT * from states'));
});

router.get('/cities', async (req, res) => {
    res.json(await db.many(`
    select c.id, s.name as state,  c.name as city
    from cities c
    inner join states s on s.abbrev = c.state_abbrev
    `));
});

router.get('/states/:abbrev', async (req, res) => {
    const state = await db.oneOrNone('SELECT * from states where abbrev = $(abbrev)', {
        abbrev: req.params.abbrev
    }); 

    if(!state) {
        return res.status(404).send('The state could not be found')
    }

    res.json(state);
});

// My post states is a little scuffed and I'm still trying to work through it 

router.post('/states', async (req, res) => {
    
    try{
         await db.oneOrNone('insert into states (abbrev,name) values ($(abbrev), $(name))', {
             abbrev: req.body.abbrev,
             name: req.body.name
            });

         const state = await db.one('select abbrev, name from states where abbrev = $(abbrev)', {
            abbrev: req.params.abbrev
            });

         return res.status(201).json(state);

        } catch (ex) {
            if(error.constraint === 'states_pkey'){
                return res.status(400).send('The state already exists')
            }
        }
});


router.post('/cities', async (req, res) => {
    try{
        const ins = await db.oneOrNone('insert into cities (state_abbrev, name, climate) values ($(state_abbrev), $(name), $(climate)) RETURNING id', {
            state_abbrev: req.body.state_abbrev,
            name: req.body.name, 
            climate: req.body.climate
           });

        console.log(ins);

        const city = await db.one('select state_abbrev, name, climate from cities where id = $(id)', {
            id: ins.id
           });

           return res.status(201).json(city);

       } catch (ex) {
           if(error.constraint === 'cities_pkey'){
                return res.status(400).send('The city already exists')
             }
         }
    });


router.post('/temperature', async (req, res) => {
    try{
        await db.none('insert into temperatures (city_id, temperature) values ($(city_id), $(temperature))', {
            city_id: req.body.city_id, 
            temperature: req.body.temperature
           });

        const temperature = await db.one('select city_id, name from temperatures where city_id= $(city_id)', {
            city_id: req.params.city_id
           });
           res.status(201).json(temperature);
       } catch (ex) {
           console.log(ex);
           res.status(500).send(ex);
       }
}
);

router.get('/cities/:id', async (req, res) => {
    const cities = await db.oneOrNone('SELECT * from cities where id = $(id)', {
        id: req.params.id
    }); 

    if(!cities) {
        return res.status(404).send('The city could not be found')
    }

    res.json(cities);
});

router.get('/temperatures/:id', async (req, res) => {
    const temperature = await db.oneOrNone(`
    select c.name, avg(temperature)
    from temperatures t
    inner join cities c on c.id = t.city_id
    where c.id = $(city_id)
    group by c.id, c.name
    `, {
        city_id: req.params.id
    }); 

    if(!temperature) {
        return res.status(404).send('The city could not be found')
    }

    res.json(temperature);
});

//Get temp by id works but for some reason get temp by climate doesn't work and I can't seem to figure it out. 

router.get('/temperatures/:climate', async (req, res) => {
    const temperature = await db.oneOrNone(`
    select climate, c.name, avg(temperature)
    from temperatures t
    inner join cities c on c.id = t.city_id
    where c.climate = $(climate)
    group by c.id, c.name, c.climate
    `, {
        climate: req.params.climate
    }); 

    if(!temperature) {
        return res.status(404).send('The city could not be found')
    }

    res.json(temperature);
});

router.delete('/cities/:id', async (req, res) => {
    await db.none(`DELETE FROM cities WHERE id = $(id)`, {
        id: +req.params.id
    });
    return res.status(204).send();
});

router.delete('/temperatures/:id', async (req, res) =>{
    await db.none(`DELETE FROM temperatures WHERE id = $(id)`, {
        id: +req.params.id
    });
    return res.status(204).send();
});

router.delete('/states/:abbrev', async (req, res) =>{
    await db.none(`DELETE FROM states WHERE abbrev = $(abbrev)`, {
        abbrev: req.params.abbrev
    });
    return res.status(204).send();
});

router.put('/states/:abbrev', async (req, res) => {
    await db.none(`UPDATE states SET abbrev = $(abbrev), name = $(name) WHERE abbrev = $(abbrev)`, {
        abbrev: req.body.abbrev,
        name: req.body.name,
          });
    const state = await db.one('select abbrev, name from states where abbrev = $(abbrev)', {
        abbrev: req.params.abbrev
        });
        return res.status(201).json(state);
});

router.put('/cities/:id', async (req, res) =>{
    await db.none(`UPDATE cities SET state_abbrev = $(state_abbrev), name = $(name), climate = $(climate) WHERE id = $(id)`, {
        state_abbrev: req.body.state_abbrev,
        name: req.body.name,
        climate: req.body.climate,
        id: req.params.id
          });
    const city = await db.one('SELECT state_abbrev, name, id FROM cities WHERE id = $(id)', {
        id: req.params.id
        });
        return res.status(201).json(city);
});

router.put('/temperatures/:id', async (req,res) => {

    await db.none(`UPDATE temperatures SET city_id = $(city_id), temperature = $(temperature) WHERE id = $(id)`, {
        city_id: req.body.city_id,
        temperature: req.body.temperature,
        id: req.params.id
          });
    const temp = await db.one('SELECT city_id, temperature, id FROM temperatures WHERE id = $(id)', {
        id: req.params.id
        });
        return res.status(201).json(temp);
})

module.exports = router;
