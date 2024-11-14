from collections import OrderedDict
import yaml


class data_writer:
    def __init__(self):
        pass

    def update_info(self, current_data, path, key):
        
        # Read YAML file
        with open(path, 'r') as file:
            data = yaml.safe_load(file)

            for e in current_data:
                data[key].update(current_data[e])

            with open(path, 'w', encoding='utf8') as file:
                yaml.dump(data, file, default_flow_style=False, allow_unicode=True, sort_keys=False)   

            # for debugging
            #print(yaml.dump(data, default_flow_style=False, allow_unicode=True))
